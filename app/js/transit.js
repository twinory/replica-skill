// Metro routing: walk to a station, ride, walk to the destination.

import { haversine } from './geo.js';
import { metroFare } from './graph.js';

const RIDE_PER_STOP = 125; // seconds, including dwell
const WAIT = 210;

function dedupe(pts) {
  const out = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  return out;
}

function metroGeometry(world, rides) {
  const pts = [];
  for (const ride of rides) {
    const line = world.metroLines.find((l) => l.id === ride.line.id);
    if (!line) continue;
    const i = line.stops.indexOf(ride.from);
    const j = line.stops.indexOf(ride.to);
    const seg = line.stops.slice(Math.min(i, j), Math.max(i, j) + 1);
    for (const name of seg) {
      const s = world.metroByName.get(name);
      if (s) pts.push([s.x, s.y]);
    }
  }
  return dedupe(pts);
}

function rideSeconds(rides) {
  return rides.reduce((s, r) => s + r.stops * RIDE_PER_STOP + WAIT, 0);
}

export function transitOptions(router, world, from, to, opts = {}) {
  const hour = opts.hour ?? 9;
  const stations = world.metroStations;
  const lines = world.metroLines;
  const walk = (a, b) => router.route(a, b, { mode: 'walk', hour });

  const near = (pt) => stations
    .map((s) => ({ s, d: haversine(pt[0], pt[1], s.x, s.y) }))
    .filter((x) => x.d < 1700)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  const fromStations = near(from);
  const toStations = near(to);
  if (!fromStations.length || !toStations.length) return [];

  const candidates = [];
  for (const a of fromStations) {
    for (const b of toStations) {
      if (a.s.n === b.s.n) continue;
      for (const la of lines.filter((l) => l.stops.includes(a.s.n))) {
        for (const lb of lines.filter((l) => l.stops.includes(b.s.n))) {
          if (la.id !== lb.id) continue;
          const i = la.stops.indexOf(a.s.n);
          const j = la.stops.indexOf(b.s.n);
          if (i === j) continue;
          candidates.push({
            a, b, transfers: 0,
            rides: [{ line: la, from: la.stops[Math.min(i, j)], to: la.stops[Math.max(i, j)], stops: Math.abs(j - i) }],
          });
        }
      }
      // one interchange at Majestic, where the two lines cross
      if (a.s.l !== b.s.l) {
        const hub = world.metroByName.get('Nadaprabhu Kempegowda Station Majestic');
        const la = lines.find((l) => l.id === a.s.l && l.stops.includes(a.s.n));
        const lb = lines.find((l) => l.id === b.s.l && l.stops.includes(b.s.n));
        if (hub && la && lb && hub.n !== a.s.n && hub.n !== b.s.n) {
          const i = la.stops.indexOf(a.s.n);
          const h = la.stops.indexOf(hub.n);
          const k = lb.stops.indexOf(b.s.n);
          if (i >= 0 && h >= 0 && k >= 0) {
            candidates.push({
              a, b, transfers: 1,
              rides: [
                { line: la, from: la.stops[Math.min(i, h)], to: la.stops[Math.max(i, h)], stops: Math.abs(h - i) },
                { line: lb, from: lb.stops[Math.min(h, k)], to: lb.stops[Math.max(h, k)], stops: Math.abs(k - h) },
              ],
            });
          }
        }
      }
    }
  }

  const direct = walk(from, to);
  const scored = [];
  for (const c of candidates) {
    const w1 = walk(from, [c.a.s.x, c.a.s.y]);
    const w2 = walk([c.b.s.x, c.b.s.y], to);
    if (!w1 || !w2) continue;
    const ride = rideSeconds(c.rides);
    const transfer = c.transfers * 240;
    const seconds = w1.seconds + ride + transfer + w2.seconds;
    // Do not dress up a 400 m errand as a 42 minute metro trip. Offer metro
    // whenever the walk is short, but drop options that are absurd next to it.
    if (direct) {
      if (direct.metres < 600) continue;
      if (seconds > direct.seconds * 3 + 480) continue;
    }
    scored.push({ ...c, w1, w2, seconds, ride });
  }
  scored.sort((a, b) => a.seconds - b.seconds);

  const seen = new Set();
  const best = [];
  for (const r of scored) {
    const key = r.a.s.n + '|' + r.b.s.n + '|' + r.transfers;
    if (seen.has(key)) continue;
    seen.add(key);
    best.push(r);
    if (best.length >= 3) break;
  }

  return best.map((r) => {
    const geom = metroGeometry(world, r.rides);
    const legs = [{
      type: 'walk', metres: r.w1.metres, seconds: r.w1.seconds,
      geometry: r.w1.geometry, to: r.a.s.n, steps: r.w1.steps,
    }, {
      type: 'metro', rides: r.rides, seconds: r.ride, stops: r.rides.reduce((s, x) => s + x.stops, 0),
      transfers: r.transfers, geometry: geom, fare: metroFare(r.rides.reduce((s, x) => s + x.stops, 0)),
    }, {
      type: 'walk', metres: r.w2.metres, seconds: r.w2.seconds,
      geometry: r.w2.geometry, from: r.b.s.n, steps: r.w2.steps,
    }];
    const metres = r.w1.metres + r.w2.metres;
    return {
      mode: 'transit', legs, metres, seconds: r.seconds,
      fare: metroFare(r.rides.reduce((s, x) => s + x.stops, 0)),
      geometry: legs.flatMap((l) => l.geometry),
      steps: buildTransitSteps(legs),
      noise: 42, kind: r.transfers ? 'transfer' : 'fast',
      stations: { from: r.a.s.n, to: r.b.s.n },
      stops: r.rides.reduce((s, x) => s + x.stops, 0),
      transfers: r.transfers,
      walk: direct ? { seconds: direct.seconds, metres: direct.metres } : null,
    };
  });
}

function buildTransitSteps(legs) {
  const steps = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
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
          road: ride.line.name, icon: 'train', metres: 0,
          seconds: leg.seconds / leg.rides.length, geometry: leg.geometry,
          turn: 'ride', stops: ride.stops,
        });
        steps.push({
          instruction: `Get off at ${ride.to}`, road: '', icon: 'pin',
          metres: 0, seconds: 0, geometry: [], turn: 'stop',
        });
      }
    }
  }
  steps.push({ instruction: 'Arrive at your destination', road: '', icon: 'flag', metres: 0, seconds: 0, geometry: [], turn: 'arrive' });
  return steps;
}

export function metroLinesForMap(world) {
  return world.metroLines.map((l) => ({
    ...l,
    geometry: l.stops.map((n) => world.metroByName.get(n)).filter(Boolean).map((s) => [s.x, s.y]),
  }));
}
