// The fixes layer: quiet routes, street fix reports, step free filter.
// Ratings and review text here are local demo data written for this clone.

import { clamp, haversine, hash, uid } from './geo.js';
import { getState, addFix, setFixStatus } from './store.js';

const ISSUES = {
  pavement: { label: 'Broken pavement', icon: 'walk', weight: 3, desc: 'Uneven or missing footpath' },
  crossing: { label: 'Unsafe crossing', icon: 'crosshair', weight: 3, desc: 'No signal, no zebra, fast traffic' },
  lighting: { label: 'Poor lighting', icon: 'sun', weight: 2, desc: 'Dark at night' },
  wheelchair: { label: 'Not step free', icon: 'wheelchair', weight: 2, desc: 'Steps or a kerb with no ramp' },
  flooding: { label: 'Floods in rain', icon: 'waves', weight: 2, desc: 'Waterlogging after rain' },
  parking: { label: 'Blocked by parking', icon: 'car', weight: 1, desc: 'Vehicles parked on the footpath' },
};

export const ISSUE_LIST = Object.entries(ISSUES).map(([id, v]) => ({ id, ...v }));

/** Deterministic demo fixes per place, stable across reloads. */
export function demoFixesFor(place) {
  const seed = hash(place.id.split('').reduce((a, c) => a + c.charCodeAt(0), 7));
  const out = [];
  if (seed > 0.55) {
    const keys = Object.keys(ISSUES);
    const n = seed > 0.86 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const k = keys[Math.floor(hash(seed * 1000 + i * 37) * keys.length) % keys.length];
      out.push({
        id: 'demo-' + place.id + '-' + i, issue: k, demo: true,
        status: seed > 0.8 ? 'acknowledged' : 'reported',
        at: Date.now() - Math.round(seed * 40 + i * 9) * 86400000,
        note: demoNote(k, seed),
      });
    }
  }
  return out;
}

function demoNote(k, seed) {
  const notes = {
    pavement: ['Footpath broken for the last stretch of the block', 'Tiles lifted after the last dig', 'No footpath at all on one side'],
    crossing: ['Crossing here needs a signal at peak hour', 'Cars do not stop at the zebra', 'No dropped kerb on either side'],
    lighting: ['Two street lights out along this stretch', 'Very dark after 8pm'],
    wheelchair: ['Step at the entrance, no ramp', 'Lift is often out of service'],
    flooding: ['Knee deep water after a heavy shower', 'Drain blocked, floods every monsoon'],
    parking: ['Scooters parked across the footpath all day', 'Cars block the kerb ramp'],
  };
  const list = notes[k] || ['Reported by a neighbour'];
  return list[Math.floor(seed * 97) % list.length];
}

/** Local fixes plus the community demo, newest first. */
export function fixesFor(placeId) {
  const local = getState().fixes.filter((f) => f.placeId === placeId);
  const demo = local.length ? [] : demoFixesFor({ id: placeId });
  return [...local.map((f) => ({ ...f, issue: f.issue || 'pavement' })), ...demo];
}

export function openFixCount(placeId) {
  return fixesFor(placeId).filter((f) => f.status !== 'fixed').length;
}

export function fixSeverity(placeId) {
  const list = fixesFor(placeId).filter((f) => f.status !== 'fixed');
  return list.reduce((s, f) => s + (ISSUES[f.issue]?.weight || 1), 0);
}

/** 0 to 100, higher is calmer. Deterministic per place, dips with reported fixes. */
export function quietScore(place) {
  const n = clamp(fixSeverity(place.id) * 6, 0, 45);
  const base = 52 + Math.round(hash(place.id.length * 13 + place.name.length * 7) * 30);
  return clamp(base - n, 5, 98);
}

export function quietLabel(score) {
  if (score >= 78) return { label: 'Very calm', tone: 'quiet' };
  if (score >= 62) return { label: 'Fairly calm', tone: 'quiet' };
  if (score >= 44) return { label: 'Busy', tone: 'warn' };
  return { label: 'Very busy', tone: 'warn' };
}

/** Editorial style guide notes for this clone, clearly local demo content. */
const NOTE_LINES = [
  'Go early on a weekday for a quiet table by the window',
  'The lane behind is calmer than the main road entrance',
  'Step free entry from the side gate, ask at the counter',
  'Best light is around 7am, before the shutters go up',
  'Footpath outside is narrow, watch for two wheelers',
  'Come from the park side to skip the junction traffic',
];

export function guideNote(place) {
  const seed = hash(place.name.length * 31 + place.lon * 1000 + place.lat * 1000);
  return NOTE_LINES[Math.floor(seed * NOTE_LINES.length) % NOTE_LINES.length];
}

export function reportFix({ placeId, name, issue, detail, lon, lat }) {
  return addFix({ placeId, name, issue, detail: (detail || '').slice(0, 300), lon, lat });
}

export { ISSUES, setFixStatus };

/** Points to draw on the fixes layer: reported issues around the map. */
export function fixMarkers(world) {
  const local = getState().fixes.filter((f) => f.lon != null);
  const out = local.map((f) => ({
    id: f.id, lon: f.lon, lat: f.lat, issue: f.issue, status: f.status, mine: true,
    label: ISSUES[f.issue]?.label || 'Reported fix',
  }));
  // a deterministic scatter of demo reports near busy streets
  const seedBase = getState().fixes.length + 3;
  const spots = world.places.filter((p) => p.cat === 'food' || p.cat === 'culture');
  for (let i = 0; i < Math.min(14, spots.length); i++) {
    const p = spots[Math.floor(hash(seedBase * 7919 + i * 13) * spots.length) % spots.length];
    if (!p) continue;
    if (out.some((o) => Math.abs(o.lon - p.lon) < 1e-5 && Math.abs(o.lat - p.lat) < 1e-5)) continue;
    const issues = Object.keys(ISSUES);
    const issue = issues[Math.floor(hash(seedBase + i * 29) * issues.length) % issues.length];
    out.push({
      id: 'demo-marker-' + p.id, lon: p.lon, lat: p.lat, issue,
      status: hash(seedBase + i) > 0.7 ? 'acknowledged' : 'reported',
      mine: false, label: ISSUES[issue].label, placeId: p.id,
    });
  }
  return out;
}

export function nearbyFixCount(world, lon, lat, radius = 500) {
  return fixMarkers(world).filter((m) => haversine(lon, lat, m.lon, m.lat) <= radius).length;
}

export function newId() {
  return uid();
}
