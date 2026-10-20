// Routing over the surveyed street graph. Pure functions, no DOM.

import { bearing, compass, haversine, hash, turnType } from './geo.js';

const MODE_BIT = { drive: 1, bike: 2, walk: 4 };
const SPEED = {
  // km/h by class: primary, secondary, tertiary, residential, service, path
  drive: [34, 27, 23, 18, 12, 6],
  bike: [17, 17, 16, 15, 12, 10],
  walk: [4.6, 4.6, 4.7, 4.8, 4.8, 4.6],
};
const CONGEST = {
  drive: [0.55, 0.42, 0.32, 0.22, 0.12, 0],
  bike: [0.18, 0.15, 0.12, 0.08, 0.04, 0],
  walk: [0, 0, 0, 0, 0, 0],
};

export function peakCurve(hour) {
  const g = (h, mu, sigma) => Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma));
  return Math.min(1, g(hour, 9.4, 2.1) + g(hour, 18.4, 2.3) + 0.18 * g(hour, 13.2, 3.6));
}

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, pri) {
    const a = this.a;
    a.push([pri, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export class Router {
  constructor(world) {
    this.world = world;
    this.nodes = world.graph.nodes;
    this.edges = world.graph.edges;
    this.adj = this.nodes.map(() => []);
    this.edges.forEach((e, idx) => {
      const name = e.name >= 0 ? world.roadNames[e.name] || '' : '';
      if (e.modes & 1) {
        if (e.oneway >= 0) this.adj[e.a].push({ to: e.b, i: idx, rev: false, name });
        if (e.oneway <= 0) this.adj[e.b].push({ to: e.a, i: idx, rev: true, name });
      }
      if (e.modes & 2) {
        this.adj[e.a].push({ to: e.b, i: idx, rev: false, name });
        if (e.oneway !== 1) this.adj[e.b].push({ to: e.a, i: idx, rev: true, name });
      }
      if (e.modes & 4) {
        this.adj[e.a].push({ to: e.b, i: idx, rev: false, name });
        this.adj[e.b].push({ to: e.a, i: idx, rev: true, name });
      }
    });
    this.components = {};
    for (const mode of ['drive', 'bike', 'walk']) this.components[mode] = this.computeComponents(mode);
    this.cache = new Map();
  }

  computeComponents(mode) {
    const bit = MODE_BIT[mode];
    const parent = new Int32Array(this.nodes.length);
    for (let i = 0; i < parent.length; i++) parent[i] = i;
    const find = (x) => {
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    const union = (a, b) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent[rb] = ra;
    };
    for (const e of this.edges) if (e.modes & bit) union(e.a, e.b);
    const groups = new Map();
    for (let i = 0; i < this.nodes.length; i++) {
      const r = find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    let best = [];
    for (const g of groups.values()) if (g.length > best.length) best = g;
    return { ids: new Set(best), size: best.length, total: groups.size };
  }

  nearestNode(lon, lat, mode) {
    const set = this.components[mode].ids;
    let best = -1, bestD = Infinity, fallback = -1, fallbackD = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const d = haversine(lon, lat, n.lon, n.lat);
      if (d < fallbackD) { fallbackD = d; fallback = i; }
      if (set.has(i) && d < bestD) { bestD = d; best = i; }
    }
    if (best === -1) return { node: fallback, metres: fallbackD };
    return { node: best, metres: bestD };
  }

  edgeCost(edge, mode, opts) {
    const cls = edge.cls;
    const speed = SPEED[mode][cls] || 15;
    let factor = 1;
    if (mode === 'drive' || mode === 'bike') {
      const peak = peakCurve(opts.hour ?? 9);
      const jitter = 0.78 + 0.44 * hash(edge.a * 31 + edge.b * 17 + edge.cls);
      factor += peak * CONGEST[mode][cls] * jitter;
    }
    const seconds = (edge.metres / (speed / 3.6)) * factor;
    let cost = seconds;
    if (opts.quiet) cost *= 1 + (edge.noise / 100) ** 2 * 2.6;
    if ((opts.accessibility || opts.avoidSteps) && edge.steps) return null;
    return { cost, seconds, metres: edge.metres };
  }

  shortest(fromNode, toNode, mode, opts = {}) {
    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prevEdge = new Int32Array(n).fill(-1);
    const prevNode = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const target = this.nodes[toNode];
    const maxSpeed = Math.max(...SPEED[mode]) / 3.6;
    const h = (i) => haversine(this.nodes[i].lon, this.nodes[i].lat, target.lon, target.lat) / maxSpeed;
    const heap = new Heap();
    dist[fromNode] = 0;
    heap.push(fromNode, h(fromNode));
    let found = false;
    while (heap.size) {
      const [, u] = heap.pop();
      if (closed[u]) continue;
      closed[u] = 1;
      if (u === toNode) { found = true; break; }
      for (const link of this.adj[u]) {
        const modeBit = MODE_BIT[mode];
        const edge = this.edges[link.i];
        if (!(edge.modes & modeBit)) continue;
        if (mode === 'drive') {
          if (edge.oneway === 1 && link.rev) continue;
          if (edge.oneway === -1 && !link.rev) continue;
          if (edge.steps) continue;
        }
        if (mode === 'bike' && edge.steps) continue;
        const c = this.edgeCost(edge, mode, opts);
        if (!c) continue;
        const nd = dist[u] + c.cost;
        if (nd < dist[link.to] - 1e-6) {
          dist[link.to] = nd;
          prevEdge[link.to] = link.i;
          prevNode[link.to] = u;
          heap.push(link.to, nd + h(link.to));
        }
      }
    }
    if (!found) return null;
    const nodes = [];
    const edges = [];
    let cur = toNode;
    let guard = 0;
    while (cur !== fromNode && guard++ < 10000) {
      nodes.push(cur);
      edges.push(prevEdge[cur]);
      cur = prevNode[cur];
      if (cur < 0) return null;
    }
    nodes.push(fromNode);
    nodes.reverse();
    edges.reverse();
    let metres = 0, noiseSum = 0, seconds = 0;
    for (const ei of edges) {
      const e = this.edges[ei];
      metres += e.metres;
      seconds += e.metres / ((SPEED[mode][e.cls] || 15) / 3.6);
      noiseSum += e.noise * e.metres;
    }
    return {
      nodes, edges, metres, seconds,
      freeSeconds: seconds,
      noise: metres ? noiseSum / metres : 0,
      geometry: nodes.map((i) => [this.nodes[i].lon, this.nodes[i].lat]),
      mode,
    };
  }

  route(from, to, opts = {}) {
    const mode = opts.mode || 'walk';
    const a = opts.fromNode ?? this.nearestNode(from[0], from[1], mode).node;
    const b = opts.toNode ?? this.nearestNode(to[0], to[1], mode).node;
    if (a === b) {
      return {
        nodes: [a], edges: [], metres: haversine(from[0], from[1], to[0], to[1]), seconds: 0,
        freeSeconds: 0, noise: 0, geometry: [from, to], mode, steps: [], snapStart: 0, snapEnd: 0,
      };
    }
    const r = this.shortest(a, b, mode, opts);
    if (!r) return null;
    r.steps = buildSteps(this, r, opts.destName);
    r.snapStart = haversine(from[0], from[1], this.nodes[a].lon, this.nodes[a].lat);
    r.snapEnd = haversine(to[0], to[1], this.nodes[b].lon, this.nodes[b].lat);
    return r;
  }

  /** Fastest, then quietest or step free variants, deduped. */
  options(from, to, opts = {}) {
    const mode = opts.mode || 'walk';
    const out = [];
    const push = (r, kind) => {
      if (!r || !r.geometry || r.geometry.length < 2) return;
      const sig = r.edges.join(',');
      if (out.some((o) => o.sig === sig)) return;
      out.push({ ...r, kind, sig });
    };
    const base = this.route(from, to, { ...opts, mode, quiet: false, accessibility: false });
    push(base, 'fast');
    if (mode === 'walk' || mode === 'bike') {
      const acc = this.route(from, to, { ...opts, mode, quiet: false, accessibility: true });
      if (acc) push(acc, 'stepfree');
    }
    if (mode !== 'walk') {
      const quiet = this.route(from, to, { ...opts, mode, quiet: true, accessibility: false });
      if (quiet && (!base || quiet.metres < base.metres * 1.9)) push(quiet, 'quiet');
    }
    return out;
  }
}

export function metroFare(stops) {
  return Math.min(60, 10 + Math.max(0, stops - 2) * 5);
}

function buildSteps(router, route, destName) {
  const steps = [];
  const edges = route.edges.map((i) => router.edges[i]);
  if (!edges.length) return steps;
  const nodeLL = (i) => [router.nodes[i].lon, router.nodes[i].lat];
  let group = null;
  let groupStart = 0;
  const flush = (endIdx) => {
    if (!group) return;
    const seq = route.nodes.slice(groupStart, endIdx + 1).map(nodeLL);
    const first = seq[0];
    const last = seq[seq.length - 1];
    const head = first && last ? bearing(first[0], first[1], last[0], last[1]) : 0;
    const instruction = group.name ? `Head ${compass(head)} on ${group.name}` : `Head ${compass(head)}`;
    steps.push({
      instruction, road: group.name || '', icon: 'arrowUp',
      metres: group.metres, seconds: group.seconds, geometry: [first, last],
      turn: 'start',
    });
    group = null;
  };
  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const name = e.name >= 0 ? router.world.roadNames[e.name] || '' : '';
    if (!group) {
      group = { name, metres: 0, seconds: 0, cls: e.cls };
      groupStart = i;
    } else if (name !== group.name) {
      flush(i);
      group = { name, metres: 0, seconds: 0, cls: e.cls };
      groupStart = i;
    }
    group.metres += e.metres;
    group.seconds += router.edgeCost(e, route.mode, { hour: 9 })?.seconds || e.metres / 5;
  }
  flush(edges.length - 1);

  const out = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (i > 0) {
      const prev = steps[i - 1];
      const a = prev.geometry[0];
      const b = prev.geometry[1];
      const c = s.geometry[1] || s.geometry[0];
      if (a && b && c && (a[0] !== c[0] || a[1] !== c[1])) {
        const inB = bearing(a[0], a[1], b[0], b[1]);
        const outB = bearing(b[0], b[1], c[0], c[1]);
        const t = turnType(inB, outB);
        if (Math.abs(t.d) > 24) {
          s.icon = turnIcon(t.key);
          s.instruction = s.road ? `${turnLabel(t.key)} onto ${s.road}` : turnLabel(t.key);
          s.turn = t.key;
        } else {
          s.instruction = s.road ? `Continue on ${s.road}` : 'Continue straight';
          s.icon = 'arrowUp';
        }
      }
    }
    out.push(s);
  }
  out.push({
    instruction: destName ? `Arrive at ${destName}` : 'Arrive at your destination',
    road: '', icon: 'flag', metres: 0, seconds: 0, geometry: [], turn: 'arrive',
  });
  return out;
}

function transitSteps(legs) {
  const steps = [];
  legs.forEach((leg, i) => {
    if (leg.type === 'walk') {
      steps.push({
        instruction: i === 0 ? `Walk to ${leg.to}` : 'Walk to your destination',
        road: '', icon: 'walk', metres: leg.metres, seconds: leg.seconds,
        geometry: leg.geometry, turn: 'walk',
      });
    } else {
      for (const ride of leg.rides) {
        steps.push({
          instruction: `Take the ${ride.line.name} towards ${ride.line.stops[ride.line.stops.length - 1]}`,
          road: ride.line.name, icon: 'train', metres: 0, seconds: leg.seconds / leg.rides.length,
          geometry: leg.geometry, turn: 'ride', stops: ride.stops,
        });
        steps.push({
          instruction: `Get off at ${ride.to}`, road: '', icon: 'pin',
          metres: 0, seconds: 0, geometry: [], turn: 'stop',
        });
      }
    }
  });
  steps.push({ instruction: 'Arrive at your destination', road: '', icon: 'flag', metres: 0, seconds: 0, geometry: [], turn: 'arrive' });
  return steps;
}

function turnLabel(t) {
  return {
    left: 'Turn left', right: 'Turn right',
    'slight-left': 'Bear left', 'slight-right': 'Bear right',
    straight: 'Continue straight', uturn: 'Make a U-turn',
    start: 'Start', walk: 'Walk', arrive: 'Arrive',
  }[t] || 'Continue';
}

function turnIcon(t) {
  return {
    left: 'arrowLeft', right: 'arrowRight',
    'slight-left': 'arrowUpLeft', 'slight-right': 'arrowUpRight',
    straight: 'arrowUp', uturn: 'uturn', arrive: 'flag', walk: 'walk', ride: 'train',
  }[t] || 'arrowUp';
}

export function autoFare(metres, seconds, kind = 'auto') {
  const km = metres / 1000;
  const min = seconds / 60;
  if (kind === 'cab') return Math.round(95 + km * 24 + min * 1.4);
  if (kind === 'bike') return Math.round(28 + km * 9 + min * 0.6);
  return Math.max(40, Math.round(32 + km * 16 + min * 0.8));
}
