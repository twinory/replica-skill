// Loads the survey dataset and precomputes world coordinates and indexes.

import { project } from './proj.js';
import { haversine } from './geo.js';
import { CATS } from './icons.js';

export const SUB_LABEL = {
  restaurant: 'Restaurant', fast_food: 'Fast food', cafe: 'Cafe', pub: 'Pub',
  bar: 'Bar', food_court: 'Food court', ice_cream: 'Ice cream', bakery: 'Bakery',
  biergarten: 'Beer garden',
  bank: 'Bank', atm: 'ATM', post_office: 'Post office', police: 'Police',
  courthouse: 'Court', embassy: 'Embassy', government: 'Government office',
  townhall: 'Town hall', fire_station: 'Fire station', fuel: 'Fuel station',
  parking: 'Parking', toilets: 'Public toilets', community_centre: 'Community centre',
  arts_centre: 'Arts centre',
  hospital: 'Hospital', pharmacy: 'Pharmacy', clinic: 'Clinic', doctors: 'Doctor',
  dentist: 'Dentist', veterinary: 'Vet', nursing_home: 'Nursing home',
  museum: 'Museum', attraction: 'Attraction', artwork: 'Public art',
  memorial: 'Memorial', theatre: 'Theatre', cinema: 'Cinema', library: 'Library',
  gallery: 'Gallery', planetarium: 'Planetarium', archive: 'Archive', zoo: 'Zoo',
  school: 'School', university: 'University', college: 'College',
  kindergarten: 'Kindergarten', language_school: 'Language school',
  driving_school: 'Driving school', music_school: 'Music school',
  temple: 'Place of worship',
  hotel: 'Hotel', hostel: 'Hostel', guest_house: 'Guest house', motel: 'Motel',
  apartment: 'Apartments',
  park: 'Park', garden: 'Garden', pitch: 'Sports pitch',
  sports_centre: 'Sports centre', swimming_pool: 'Swimming pool',
  stadium: 'Stadium', playground: 'Playground', fitness_centre: 'Gym',
  track: 'Running track',
  mall: 'Mall', department_store: 'Department store', books: 'Bookshop',
  clothes: 'Clothing shop', shoes: 'Shoe shop', jewelry: 'Jewellery',
  electronics: 'Electronics', computers: 'Computers', gift: 'Gift shop',
  art: 'Art shop', craft: 'Crafts', music: 'Music shop', sports: 'Sports shop',
  toys: 'Toy shop', bag: 'Bags', watches: 'Watches', cosmetics: 'Cosmetics',
  convenience: 'Convenience store', supermarket: 'Supermarket',
  car: 'Car dealer', motorcycle: 'Motorcycle shop', bicycle: 'Bike shop',
  furniture: 'Furniture', hardware: 'Hardware', optician: 'Optician',
  photo: 'Photo studio', stationery: 'Stationery', travel_agency: 'Travel agency',
  shop: 'Shop',
  metrostation: 'Metro station', station: 'Station', entrance: 'Metro entrance',
  bus: 'Bus stop',
  office: 'Office',
};

export function subLabel(sub) {
  return SUB_LABEL[sub] || (sub ? sub.replace(/_/g, ' ') : 'Place');
}

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function searchEntry(kind, item, title, sub, weight) {
  const n = norm(title);
  const words = n.split(/[^a-z0-9]+/).filter(Boolean);
  return {
    kind, id: item.id || item.name, item,
    title, sub, norm: n, words,
    initials: words.map((w) => w[0]).join(''),
    weight,
    lon: item.x !== undefined ? item.x : item.lon,
    lat: item.y !== undefined ? item.y : item.lat,
  };
}

const WEIGHT = { culture: 8, transit: 7, food: 6, park: 5, shop: 4, worship: 3, stay: 3, cafe: 5, edu: 2, civic: 1, health: 2, office: 1 };

export async function loadWorld(base = './data/') {
  const names = ['meta', 'roads', 'areas', 'places', 'graph', 'metro'];
  const res = await Promise.all(names.map((n) => fetch(base + n + '.json', { cache: 'force-cache' })));
  for (const r of res) if (!r.ok) throw new Error('Could not load ' + r.url);
  const [meta, roads, areas, placesFile, graph, metro] = await Promise.all(res.map((r) => r.json()));

  const world = { meta, bounds: meta.bounds, center: meta.center };

  // roads
  world.roads = roads.roads.map((r) => {
    const pts = r.p.map(([lon, lat]) => project(lon, lat));
    let bounds = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of pts) {
      if (p[0] < bounds[0]) bounds[0] = p[0];
      if (p[1] < bounds[1]) bounds[1] = p[1];
      if (p[0] > bounds[2]) bounds[2] = p[0];
      if (p[1] > bounds[3]) bounds[3] = p[1];
    }
    return { id: r.i, cls: r.c, name: r.n >= 0 ? roads.names[r.n] : '', n: r.n, pts, ll: r.p, bounds };
  });
  world.roadNames = roads.names;

  // areas
  const prep = (list) => list.map((a) => {
    const pts = a.p.map(([lon, lat]) => project(lon, lat));
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const [x, y] of pts) {
      if (x < minx) minx = x;
      if (y < miny) miny = y;
      if (x > maxx) maxx = x;
      if (y > maxy) maxy = y;
    }
    return { ...a, pts, ll: a.p, bounds: [minx, miny, maxx, maxy] };
  });
  world.parks = prep(areas.parks);
  world.water = prep(areas.water);
  world.pitches = prep(areas.pitches);
  world.buildings = prep(areas.buildings);
  world.areaBounds = [
    Math.min(...[...world.parks, ...world.water, ...world.buildings].map((a) => a.bounds[0])),
    Math.min(...[...world.parks, ...world.water, ...world.buildings].map((a) => a.bounds[1])),
    Math.max(...[...world.parks, ...world.water, ...world.buildings].map((a) => a.bounds[2])),
    Math.max(...[...world.parks, ...world.water, ...world.buildings].map((a) => a.bounds[3])),
  ];

  // places
  world.places = placesFile.places.map((p) => {
    const [wx, wy] = project(p.x, p.y);
    return {
      id: p.id, name: p.n, cat: p.c, sub: p.s, lon: p.x, lat: p.y,
      wx, wy, tags: p.t || {},
      kindLabel: subLabel(p.s),
      osmUrl: p.id.startsWith('w')
        ? `https://www.openstreetmap.org/way/${p.id.slice(1)}`
        : `https://www.openstreetmap.org/node/${p.id.slice(1)}`,
    };
  });
  world.placesById = new Map(world.places.map((p) => [p.id, p]));
  world.byCat = new Map();
  for (const p of world.places) {
    if (!world.byCat.has(p.cat)) world.byCat.set(p.cat, []);
    world.byCat.get(p.cat).push(p);
  }

  // graph nodes in world coords
  world.graph = {
    nodes: graph.nodes.map(([lon, lat]) => {
      const [x, y] = project(lon, lat);
      return { lon, lat, x, y };
    }),
    edges: graph.edges.map((e) => ({
      a: e[0], b: e[1], metres: e[2], cls: e[3], name: e[4],
      modes: e[5], oneway: e[6], steps: e[7], noise: e[8],
    })),
  };

  // metro
  world.metro = metro;
  world.metroStations = metro.stations.map((s) => {
    const [x, y] = project(s.x, s.y);
    return { ...s, wx: x, wy: y };
  });
  world.metroByName = new Map(world.metroStations.map((s) => [s.n, s]));
  world.metroLines = metro.lines.map((l) => {
    const stops = l.stops.map((n) => world.metroByName.get(n)).filter(Boolean);
    const [wx, wy] = stops.length ? [stops[0].wx, stops[0].wy] : [0, 0];
    return { ...l, stopsData: stops, wx, wy };
  });

  // search entries
  const entries = [];
  const CUISINE_LABEL = {
    indian: 'Indian', chinese: 'Chinese', italian: 'Italian', burger: 'Burgers',
    ice_cream: 'Ice cream', coffee_shop: 'Coffee', vegetarian: 'Vegetarian',
    seafood: 'Seafood', south_indian: 'South Indian', american: 'American',
    andhra: 'Andhra', sushi: 'Sushi', rolls: 'Rolls', portuguese: 'Portuguese',
  };
  for (const p of world.places) {
    const e = searchEntry('place', p, p.name, p.kindLabel, WEIGHT[p.cat] ?? 2);
    // Tags that say what a place serves are worth finding: search "chinese"
    // or "ice cream" should return places, not only names that contain it.
    const cuisines = String(p.tags?.cuisine || '').toLowerCase().split(/[;,]/).map((c) => c.trim()).filter(Boolean);
    for (const c of cuisines) {
      const words = norm(c.replace(/_/g, ' ')).split(/[^a-z0-9]+/).filter(Boolean);
      e.words.push(...words);
      (e.cuisine = e.cuisine || []).push(...words);
      const label = CUISINE_LABEL[c] || c.replace(/_/g, ' ');
      e.sub = `${p.kindLabel} \u00b7 ${label}`;
    }
    entries.push(e);
  }
  // road names as searchable
  world.roadGroups = new Map();
  for (const r of world.roads) {
    if (!r.name) continue;
    if (!world.roadGroups.has(r.name)) world.roadGroups.set(r.name, []);
    world.roadGroups.get(r.name).push(r);
  }
  for (const [name, group] of world.roadGroups) {
    const pts = group.flatMap((r) => r.ll);
    const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    entries.push(searchEntry('road', { id: 'road:' + name, name, x: lon, y: lat, group }, name, 'Street', 3));
  }
  const METRO_ALIAS = {
    'Mahatma Gandhi Road': ['MG Road', 'MG Road Metro'],
    'Nadaprabhu Kempegowda Station Majestic': ['Majestic', 'Kempegowda', 'Majestic Bus Stand'],
    'Dr. B R Ambedkar Station, Vidhana Soudha': ['Vidhana Soudha Metro', 'Vidhana Soudha'],
    'Indiranagar': ['Indiranagar Metro'],
    'Jayanagar': ['Jayanagar Metro'],
    'Banashankari': ['Banashankari Metro'],
    'Krishna Rajendra Market': ['KR Market', 'City Market'],
  };
  for (const s of world.metroStations) {
    const lineName = s.l === 'PURPLE' ? 'Purple Line station' : 'Green Line station';
    entries.push(searchEntry('station', { id: 'metro:' + s.n, name: s.n, x: s.x, y: s.y, station: s }, s.n, lineName, 5));
    for (const alias of METRO_ALIAS[s.n] || []) {
      const e = searchEntry('station', { id: 'metro:' + s.n, name: s.n, x: s.x, y: s.y, station: s }, alias, lineName, 5);
      e.aliasOf = s.n;
      entries.push(e);
    }
  }
  world.searchEntries = entries;
  world.searchByCat = new Map();
  for (const p of world.places) {
    if (!world.searchByCat.has(p.cat)) world.searchByCat.set(p.cat, []);
    world.searchByCat.get(p.cat).push(p);
  }

  world.catCounts = {};
  for (const p of world.places) world.catCounts[p.cat] = (world.catCounts[p.cat] || 0) + 1;

  world.search = (q, opts = {}) => search(world, q, opts);
  world.nearby = (lon, lat, { limit = 6, radius = 700, cats = null } = {}) => {
    return world.places
      .filter((p) => !cats || cats.includes(p.cat))
      .map((p) => ({ p, d: haversine(lon, lat, p.lon, p.lat) }))
      .filter((r) => r.d <= radius)
      .sort((a, b) => a.d - b.d)
      .slice(0, limit);
  };
  return world;
}

export function search(world, query, { limit = 30, center = null, cat = null } = {}) {
  const q = norm(query || '');
  let pool = world.searchEntries;
  if (cat) pool = pool.filter((e) => e.kind === 'place' && e.item.cat === cat);
  const terms = q.split(/\s+/).filter(Boolean);
  // a query that names a category should list the category, not one place
  const catHit = Object.entries(CATS).find(([id, m]) =>
    [m.label, m.short, m.plural, id].some((v) => norm(v) === q));
  const out = [];
  for (const e of pool) {
    let s = 0;
    const wordHit = e.words.some((w) => w.startsWith(q));
    if (!q) s = 1;
    else if (e.norm === q) s = 120;
    else if (e.norm.startsWith(q)) s = 92;
    else if (wordHit) s = 74;
    else if (e.initials === q.replace(/\s+/g, '')) s = 68;
    else if (terms.every((t) => e.words.some((w) => w.startsWith(t)))) s = 44;
    else if (q.length >= 4 && e.words.some((w) => w.includes(q))) s = 34;
    else if (q.length >= 4 && terms.every((t) => e.words.some((w) => w.includes(t)))) s = 26;
    if (!s) continue;
    if (e.kind === 'place') {
      const sub = norm(subLabel(e.item.sub));
      if (sub === q) s += 46;
      else if (sub.split(' ').includes(q)) s += 30;
      if (catHit) s = e.item.cat === catHit[0] ? s + 58 : s * 0.5;
      if (e.cuisine && e.cuisine.includes(q)) s += 24;
    }
    s += e.weight * 0.5;
    if (center) {
      const d = haversine(center[0], center[1], e.lon, e.lat);
      s += Math.max(0, 14 - d / 260);
    }
    out.push({ ...e, score: s, distance: center ? haversine(center[0], center[1], e.lon, e.lat) : null });
  }
  out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  // one row per name unless the query is that exact name (then every branch counts)
  const byName = new Map();
  const seen = new Set();
  const out2 = [];
  for (const e of out) {
    const k = e.kind + ':' + e.title + ':' + e.lon.toFixed(4) + ':' + e.lat.toFixed(4);
    if (seen.has(k)) continue;
    seen.add(k);
    const nk = e.kind + ':' + e.norm;
    if (e.norm !== q) {
      const n = byName.get(nk) || 0;
      if (n >= 1) continue;
      byName.set(nk, n + 1);
    }
    out2.push(e);
    if (out2.length >= limit) break;
  }
  return out2;
}

export function categoryList(world, cat, { center, limit = 40 } = {}) {
  const list = (world.byCat.get(cat) || []).map((p) => ({
    kind: 'place', id: p.id, item: p, title: p.name, sub: p.kindLabel,
    lon: p.lon, lat: p.lat,
    distance: center ? haversine(center[0], center[1], p.lon, p.lat) : null,
  }));
  if (center) list.sort((a, b) => a.distance - b.distance);
  return list.slice(0, limit);
}
