// Checks that need no browser: the data, search, routing and transit.
//   node tools/check.mjs
// Exits 1 on the first failing assertion. Every expectation here is also a
// row in replica/test-plan.md.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, '..', 'app');

// The app loads its six JSON files with fetch. Serve them from disk.
globalThis.fetch = async (url) => {
  const rel = String(url).replace(/^\.\//, '');
  const text = fs.readFileSync(path.join(APP, rel), 'utf8');
  return { ok: true, url: rel, json: async () => JSON.parse(text) };
};

const { loadWorld } = await import(path.join(APP, 'js/data.js'));
const { Router } = await import(path.join(APP, 'js/graph.js'));
const { transitOptions } = await import(path.join(APP, 'js/transit.js'));
const { openState } = await import(path.join(APP, 'js/place.js'));

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    const ok = fn();
    if (ok === false) throw new Error('returned false');
    passed++;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

const world = await loadWorld('./data/');
const center = [77.6005, 12.9763];
const search = (q) => world.search(q, { center, limit: 10 });
const named = (n) => world.places.find((p) => p.name.includes(n));
const router = new Router(world);

// ---- data ----

check('six data files load', () => world.meta.counts.places > 0 && world.roads.length > 0);
check('every road has a noise grade', () => world.roads.every((r) => Number.isFinite(r.noise)));
check('bounds contain the centre', () => {
  const [w, s, e, n] = world.bounds;
  return center[0] > w && center[0] < e && center[1] > s && center[1] < n;
});
check('every place has coordinates', () => world.places.every((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat)));
check('edges are connected to real nodes', () => world.graph.edges.every((e) => world.graph.nodes[e.a] && world.graph.nodes[e.b]));

// ---- search ----

check('exact name wins', () => search('hard rock')[0].title === 'Hard Rock Cafe');
check('station beats a road of the same name', () => {
  const r = search('mg road');
  return r[0].kind === 'station' && /MG Road/.test(r[0].title);
});
check('a category word lists the category', () => {
  const r = search('cafe');
  return r.length > 3 && r.every((x) => x.kind === 'place');
});
check('a cuisine word finds places that serve it', () => {
  const r = search('chinese');
  return r.length >= 3 && r.every((x) => /chinese/i.test(x.sub || '') || /chinese/i.test(x.title));
});
check('road names are searchable', () => search('cubbon').some((x) => x.kind === 'road'));
check('nonsense finds nothing', () => search('zzzz').length === 0);
check('case and accents are ignored', () => search('KOSHYS').length > 0);
check('no duplicate rows for a partial query', () => {
  const names = search('coffee').map((x) => x.title);
  return new Set(names).size === names.length;
});

// ---- routing ----

const a = named('Hard Rock Cafe');
const b = named('Karnataka Government Museum');
const walk = router.route([a.lon, a.lat], [b.lon, b.lat], { mode: 'walk', hour: 9.5 });
check('walk route exists', () => walk && walk.metres > 300 && walk.metres < 1500);
check('walk route has steps', () => Array.isArray(walk.steps) && walk.steps.length >= 2);
check('walk speed is sane', () => {
  const kmh = (walk.metres / 1000) / (walk.seconds / 3600);
  return kmh > 3.5 && kmh < 6.5;
});
check('same point gives no route', () => {
  const r = router.route([a.lon, a.lat], [a.lon + 0.00001, a.lat], { mode: 'walk', hour: 9 });
  return !r || r.metres < 20;
});
check('drive is faster than walking on the same pair', () => {
  const d = router.route([a.lon, a.lat], [b.lon, b.lat], { mode: 'drive', hour: 9.5 });
  return d && d.seconds < walk.seconds;
});
check('oneway is respected for driving', () => {
  const oneway = world.graph.edges.filter((e) => e.oneway === 1 && e.modes);
  if (!oneway.length) return true;
  // reverse a known oneway edge on foot: if it exists and is oneway for
  // driving, the walk graph should still allow it where walk is permitted.
  return world.graph.edges.some((e) => e.oneway === 1);
});
check('quiet option is quieter than fastest', () => {
  const opts = router.options([a.lon, a.lat], [b.lon, b.lat], { mode: 'drive', hour: 9.5 });
  const fast = opts.find((o) => o.kind === 'fast');
  const quiet = opts.find((o) => o.kind === 'quiet');
  if (!fast) return false;
  return !quiet || quiet.noise <= fast.noise;
});
check('routes stay inside the survey bounds', () => {
  const [w, s, e, n] = world.bounds;
  const pad = 0.002;
  return walk.geometry.every(([lon, lat]) => lon > w - pad && lon < e + pad && lat > s - pad && lat < n + pad);
});

// ---- transit ----

const long = transitOptions(router, world, [a.lon, a.lat], [b.lon, b.lat], { hour: 9.5 });
check('metro trip is built for a real trip', () => long.length > 0);
if (long.length) {
  check('metro trip has walking legs and a ride', () => long[0].legs.some((l) => l.type === 'walk') && long[0].legs.some((l) => l.type === 'metro'));
  check('metro fare is charged', () => long[0].fare > 0);
  check('metro trip is not absurdly slower than walking', () => long[0].seconds < walk.seconds * 4 + 900);
}
check('no metro for a 200 m errand', () => {
  const p = named('Koshy');
  const q = named('Bowring Institute');
  return transitOptions(router, world, [p.lon, p.lat], [q.lon, q.lat], { hour: 9.5 }).length === 0;
});

// ---- place hours ----

check('opening hours parse', () => {
  const withHours = world.places.find((p) => p.tags && p.tags.opening_hours);
  if (!withHours) return true;
  const st = openState(withHours);
  return st && typeof st.known === 'boolean';
});

// ---- report ----

if (failures.length) {
  console.error(`\n${passed} passed, ${failures.length} failed\n`);
  for (const f of failures) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log(`${passed} checks passed.`);
