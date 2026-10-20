// Local-first state: saved places, notes, fixes, settings.

import { uid } from './geo.js';

const KEY = 'chowk.v1';

const DEFAULTS = {
  saved: [],            // { id, group, placeId, name, lon, lat, at }
  groups: [
    { id: 'g-yours', name: 'Your places', color: '#0b6e4f' },
    { id: 'g-weekend', name: 'Weekend list', color: '#c2410c' },
  ],
  notes: {},            // placeId: { text, updated }
  fixes: [],            // { id, placeId, name, issue, detail, status, at }
  contact: [],          // { id, placeId, name, address, note, at }
  recent: [],           // place ids
  settings: {
    theme: 'auto',
    units: 'metric',
    quietWeight: true,
    accessibility: false,
    pixel: false,
    traffic: false,
    compass: false,
    home: null,
    work: null,
    lastPlace: null,
  },
  routePrefs: { mode: 'walk', hour: 9.5 },
};

let state = null;
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
      routePrefs: { ...DEFAULTS.routePrefs, ...(parsed.routePrefs || {}) },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
  }, 80);
}

export function getState() {
  if (!state) state = load();
  return state;
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit(topic = 'change') {
  persist();
  for (const fn of listeners) fn(topic, state);
}

export function setSetting(key, value) {
  const s = getState();
  s.settings[key] = value;
  emit('settings');
}

export function resetAll() {
  state = structuredClone(DEFAULTS);
  emit('reset');
}

// ---- saved places ----

export function isSaved(placeId) {
  return getState().saved.some((s) => s.placeId === placeId);
}

export function savedEntry(placeId) {
  return getState().saved.find((s) => s.placeId === placeId) || null;
}

export function toggleSaved(place, group = 'g-yours') {
  const s = getState();
  const ix = s.saved.findIndex((x) => x.placeId === place.id);
  if (ix >= 0) {
    s.saved.splice(ix, 1);
    emit('saved');
    return false;
  }
  s.saved.unshift({
    id: uid(), group, placeId: place.id, name: place.name,
    lon: place.lon, lat: place.lat, at: Date.now(),
  });
  emit('saved');
  return true;
}

export function setSavedGroup(placeId, group) {
  const s = getState();
  const e = s.saved.find((x) => x.placeId === placeId);
  if (e) { e.group = group; emit('saved'); }
}

export function removeSaved(placeId) {
  const s = getState();
  s.saved = s.saved.filter((x) => x.placeId !== placeId);
  emit('saved');
}

export function addGroup(name, color) {
  const s = getState();
  const g = { id: 'g-' + uid(), name: name || 'New list', color: color || '#0b6e4f' };
  s.groups.push(g);
  emit('groups');
  return g;
}

export function removeGroup(id) {
  const s = getState();
  s.groups = s.groups.filter((g) => g.id !== id);
  s.saved.forEach((x) => { if (x.group === id) x.group = 'g-yours'; });
  emit('groups');
}

// ---- notes (the new feature) ----

export function getNote(placeId) {
  return getState().notes[placeId] || null;
}

export function setNote(placeId, text) {
  const s = getState();
  const t = String(text || '').trim();
  if (!t) delete s.notes[placeId];
  else s.notes[placeId] = { text: t.slice(0, 600), updated: Date.now() };
  emit('notes');
}

export function noteCount() {
  return Object.keys(getState().notes).length;
}

// ---- street fixes (the new feature) ----

export function addFix(fix) {
  const s = getState();
  const entry = {
    id: uid(), status: 'reported', at: Date.now(),
    ...fix,
  };
  s.fixes.unshift(entry);
  emit('fixes');
  return entry;
}

export function setFixStatus(id, status) {
  const s = getState();
  const f = s.fixes.find((x) => x.id === id);
  if (f) { f.status = status; f.updated = Date.now(); emit('fixes'); }
}

export function removeFix(id) {
  const s = getState();
  s.fixes = s.fixes.filter((x) => x.id !== id);
  emit('fixes');
}

export function fixCount() {
  return getState().fixes.filter((f) => f.status !== 'fixed').length;
}

// ---- accessibility contact list ----

export function addContact(entry) {
  const s = getState();
  const e = { id: uid(), at: Date.now(), status: 'to-ask', ...entry };
  s.contact.unshift(e);
  emit('contact');
  return e;
}

export function removeContact(id) {
  const s = getState();
  s.contact = s.contact.filter((x) => x.id !== id);
  emit('contact');
}

export function setContactStatus(id, status) {
  const s = getState();
  const e = s.contact.find((x) => x.id === id);
  if (e) { e.status = status; emit('contact'); }
}

// ---- recent ----

export function pushRecent(placeId) {
  const s = getState();
  s.recent = [placeId, ...s.recent.filter((x) => x !== placeId)].slice(0, 8);
  emit('recent');
}

export function setHome(place) {
  const s = getState();
  s.settings.home = place ? { lon: place.lon, lat: place.lat, name: place.name } : null;
  emit('settings');
}

export function setWork(place) {
  const s = getState();
  s.settings.work = place ? { lon: place.lon, lat: place.lat, name: place.name } : null;
  emit('settings');
}

export function setMode(mode) {
  const s = getState();
  s.routePrefs.mode = mode;
  emit('route');
}

export function setHour(hour) {
  const s = getState();
  s.routePrefs.hour = hour;
  emit('route');
}

export function exportAll() {
  const s = getState();
  return JSON.stringify({
    app: 'Chowk',
    exported: new Date().toISOString(),
    saved: s.saved, groups: s.groups, notes: s.notes,
    fixes: s.fixes, contact: s.contact, settings: s.settings,
  }, null, 2);
}
