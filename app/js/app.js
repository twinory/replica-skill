// App controller: state, events, panel rendering, overlays.

import { loadWorld, search as searchWorld } from './data.js';
import { Renderer } from './render.js';
import { Router, autoFare } from './graph.js';
import { transitOptions } from './transit.js';
import {
  makeCamera, setCamera, fitCamera, coverCamera, clampCamera, panBy, zoomAround, worldScale,
  toScreen, fromScreen, visibleBounds, metersPerPixel, MIN_ZOOM, MAX_ZOOM,
} from './proj.js';
import {
  clamp, haversine, formatClock, uid, debounce, escapeHtml as h, formatDistance, formatDuration,
} from './geo.js';
import { icon, catMeta, CATS, CAT_ORDER } from './icons.js';
import {
  masthead, searchBar, chips, exploreView, catView, resultsView, placeView,
  directionsView, savedView, fixesView, settingsView, hourLabel,
} from './panel.js';
import {
  getState, subscribe, emit, setSetting, toggleSaved, removeSaved, setNote, getNote, addGroup,
  removeGroup, isSaved, savedEntry, setHome, setWork, addContact, removeContact, setContactStatus,
  setFixStatus, removeFix, pushRecent, resetAll, exportAll, setMode, setHour, setSavedGroup,
} from './store.js';
import { ISSUE_LIST, ISSUES, reportFix, fixMarkers, quietScore } from './fixes.js';
import { drawCard, CARD_ACCENTS } from './card.js';

const app = {
  world: null,
  router: null,
  renderer: null,
  cam: null,
  view: {
    name: 'explore',
    query: '',
    searchOpen: false,
    cat: null,
    place: null,
    layers: { quiet: false, busy: false, transit: true, parks: true, accessibility: false, pixel: false },
    hover: null,
    selected: null,
    dir: { origin: null, destination: null, active: null },
    route: null,
    measure: null,
    user: null,
  },
  mapEl: null,
  panelScroll: {},
  searchSel: -1,
  lastFocus: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- boot ----------

async function boot() {
  try {
    app.world = await loadWorld('./data/');
  } catch (err) {
    document.body.innerHTML = `<div style="padding:40px;font-family:system-ui"><h1>Chowk could not load its survey</h1>
      <p>${h(err.message)}</p><p>If you opened this file directly, run a local server instead: <code>python3 -m http.server</code> inside the app folder.</p></div>`;
    return;
  }
  app.router = new Router(app.world);
  applyTheme();
  app.cam = coverCamera(app.world.bounds, window.innerWidth - panelWidth(), window.innerHeight, 16.7);

  app.mapEl = $('#map');
  app.renderer = new Renderer(app.mapEl, app.world);
  resize();
  render();
  wireEvents();
  wireStore();
  bindInputs();
  hideBoot();
  maybeTour();

  const q = new URLSearchParams(location.search);
  if (q.get('place')) {
    const p = app.world.placesById.get(q.get('place'));
    if (p) openPlace(p, { fly: true });
  } else if (q.get('q')) {
    app.view.query = q.get('q');
    app.view.name = 'results';
    render();
  }
  window.addEventListener('resize', onResize);
}

function hideBoot() {
  const b = $('#boot');
  if (!b) return;
  b.classList.add('hide');
  setTimeout(() => b.remove(), 400);
}

function panelWidth() {
  if (window.innerWidth <= 860) return 0;
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) || 396;
}

function viewportSize() {
  const r = app.mapEl ? app.mapEl.getBoundingClientRect() : { width: window.innerWidth, height: window.innerHeight };
  return { w: Math.round(r.width), h: Math.round(r.height) };
}

function onResize() {
  resize();
  render();
}

function resize() {
  if (!app.renderer) return;
  const { w, h } = viewportSize();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  app.renderer.resize(Math.max(1, w), Math.max(1, h), dpr);
  updateScale();
}

// ---------- theme ----------

function applyTheme() {
  const s = getState();
  let theme = s.settings.theme;
  if (theme === 'auto') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
  if (app.renderer) app.renderer.refreshPalette();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--c-surface').trim());
}

// ---------- render ----------

function render() {
  const s = getState();
  const scroll = $('#panel-body')?.scrollTop || 0;
  const panel = $('#panel');
  const activeCat = app.view.name === 'category' ? app.view.cat : null;
  const showSearch = ['explore', 'results', 'category', 'place', 'directions'].includes(app.view.name);
  let body = '';
  if (app.view.name === 'explore') body = exploreView(app.view, app);
  else if (app.view.name === 'results') body = resultsView(app.view, app);
  else if (app.view.name === 'category') body = catView(app.view, app, app.view.cat);
  else if (app.view.name === 'place') body = placeView(app.view, app, app.view.place);
  else if (app.view.name === 'directions') body = directionsView(app.view, app);
  else if (app.view.name === 'saved') body = savedView(app.view, app);
  else if (app.view.name === 'fixes') body = fixesView(app.view, app);
  else if (app.view.name === 'settings') body = settingsView(app.view, app);

  panel.innerHTML = `
    <button class="sheet-handle" data-act="sheet" aria-label="Expand or collapse the panel"></button>
    ${masthead(s, app)}
    ${showSearch ? searchBar(app.view, app) + chips(app.view, app, activeCat) : ''}
    <div class="panel-body" id="panel-body">
      ${app.view.name === 'place' ? `<button class="btn ghost sm" data-act="back" style="margin:10px 0 0 16px">${icon('chevronLeft', 14)} Back</button>` : ''}
      ${app.view.name === 'settings' || app.view.name === 'saved' || app.view.name === 'fixes' ? `<div class="section" style="padding-bottom:0"><button class="btn ghost sm" data-act="back" style="margin-left:-10px">${icon('chevronLeft', 14)} Back</button></div>` : ''}
      ${body}
    </div>
    <div class="panel-foot">
      <span>${app.world ? `${app.world.meta.counts.places} places surveyed` : ''}</span>
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap, ODbL</a>
    </div>`;
  const bodyEl = $('#panel-body');
  if (bodyEl) bodyEl.scrollTop = scroll;
  bindInputs();
  draw();
  syncHash();
}

let drawQueued = false;
function draw() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    if (!app.renderer) return;
    app.renderer.draw({ ...app.view, cam: app.cam, hour: getState().routePrefs.hour });
    updateScale();
    updateNorth();
  });
}

function updateScale() {
  if (!app.renderer || !app.cam) return;
  const el = $('#scale');
  if (!el) return;
  const mpp = metersPerPixel(app.cam.lat, app.cam.zoom);
  const targetPx = 64;
  const metres = mpp * targetPx;
  const nice = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  // Nearest round number by ratio, so the bar stays near 64px instead of
  // collapsing to a stub just under the target.
  let best = nice[0];
  for (const n of nice) {
    if (Math.abs(Math.log(n / metres)) < Math.abs(Math.log(best / metres))) best = n;
  }
  const px = Math.max(28, best / mpp);
  const units = getState().settings.units;
  const label = units === 'imperial'
    ? (best < 400 ? Math.round(best * 3.28084) + ' ft' : (best / 1609.344).toFixed(1) + ' mi')
    : (best >= 1000 ? best / 1000 + ' km' : best + ' m');
  $('#scale-bar').style.width = px + 'px';
  $('#scale-text').textContent = label;
}

function updateNorth() {
  const c = $('#compass');
  if (!c) return;
  c.style.display = app.view.layers.compass ? 'grid' : 'none';
}

// ---------- events ----------

function wireEvents() {
  // panel clicks
  $('#panel').addEventListener('click', onPanelClick);
  $('#panel').addEventListener('change', onPanelChange);
  $('#panel').addEventListener('input', onPanelInput);
  $('#panel').addEventListener('keydown', onPanelKey);
  $('#panel').addEventListener('focusin', onPanelFocus);

  // map gestures
  const map = app.mapEl;
  let drag = null;
  let lastTap = 0;
  let pinch = null;

  map.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (app.view.measure && e.pointerType === 'mouse') {
      const { x, y } = localPoint(e);
      const ll = fromScreen(app.cam, app.renderer.w, app.renderer.h, x, y);
      app.view.measure.points.push([ll.lon, ll.lat]);
      app.view.measure.cursor = null;
      draw();
      return;
    }
    map.setPointerCapture(e.pointerId);
    closeMenus();
    const touch = e.pointerType === 'touch';
    drag = { x: e.clientX, y: e.clientY, moved: 0, touch, startCam: { ...app.cam }, t: Date.now() };
    map.classList.add('dragging');
    if (touch && Date.now() - lastTap < 300) {
      const { x, y } = localPoint(e);
      zoomAt(x, y, app.cam.zoom + 1);
      drag = null;
    }
    lastTap = Date.now();
    // pinch
    if (e.pointerType === 'touch') {
      app.pointers = app.pointers || new Set();
      app.pointers.add(e.pointerId);
      if (app.pointers.size === 2) {
        const [a, b] = [...app.pointers];
        pinch = { dist: 0, pointers: [a, b] };
        drag = null;
      }
    }
  });

  map.addEventListener('pointermove', (e) => {
    const { x, y } = localPoint(e);
    if (pinch && app.pointers && app.pointers.size === 2) {
      // handled below with cached positions
    }
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 3) {
        panBy(app.cam, -dx, -dy);
        clampCamera(app.cam, app.world.bounds, app.renderer.w, app.renderer.h, 40);
        drag.x = e.clientX;
        drag.y = e.clientY;
        draw();
      }
      return;
    }
    if (app.view.measure) {
      const ll = fromScreen(app.cam, app.renderer.w, app.renderer.h, x, y);
      app.view.measure.cursor = [ll.lon, ll.lat];
      draw();
      return;
    }
    const hit = app.renderer.hitTest(x, y, 13);
    const id = hit ? hit.id : null;
    if (id !== app.view.hover) {
      app.view.hover = id;
      draw();
      showTooltip(hit, x, y);
    } else if (hit) {
      showTooltip(hit, x, y);
    }
  });

  const endDrag = (e) => {
    if (drag && drag.moved <= 3) {
      const { x, y } = localPoint(e);
      const hit = app.renderer.hitTest(x, y, 13);
      if (hit) {
        openPlace(hit.place, { fly: false });
      } else {
        app.view.selected = null;
        draw();
      }
    }
    drag = null;
    pinch = null;
    if (app.pointers) { app.pointers.delete(e.pointerId); if (!app.pointers.size) app.pointers = null; }
    map.classList.remove('dragging');
    hideTooltip();
  };
  map.addEventListener('pointerup', endDrag);
  map.addEventListener('pointercancel', endDrag);
  map.addEventListener('pointerleave', () => { hideTooltip(); });

  map.addEventListener('wheel', (e) => {
    e.preventDefault();
    const { x, y } = localPoint(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaY;
    const factor = Math.exp(-delta * 0.0018);
    zoomAt(x, y, app.cam.zoom + Math.log2(factor) * 1.6);
  }, { passive: false });

  // touch pinch with two pointers
  map.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (!app.pinchDist) { app.pinchDist = dist; return; }
      const r = map.getBoundingClientRect();
      const cx = (a.clientX + b.clientX) / 2 - r.left;
      const cy = (a.clientY + b.clientY) / 2 - r.top;
      const delta = Math.log2(dist / app.pinchDist);
      app.pinchDist = dist;
      zoomAt(cx, cy, app.cam.zoom + delta);
      if (app.pointers) app.pointers.clear();
      drag = null;
    }
  }, { passive: false });
  map.addEventListener('touchend', () => { app.pinchDist = 0; });

  map.addEventListener('dblclick', (e) => {
    const { x, y } = localPoint(e);
    zoomAt(x, y, app.cam.zoom + 1);
  });

  map.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const { x, y } = localPoint(e);
    const ll = fromScreen(app.cam, app.renderer.w, app.renderer.h, x, y);
    openContextMenu(x, y, ll);
  });

  // keyboard
  window.addEventListener('keydown', onKey);

  // top bar actions
  $('#map-tools').addEventListener('click', onChromeClick);
  $('#map-bottom-right').addEventListener('click', onChromeClick);
  $('#toast-wrap').addEventListener('click', () => {});

  // history
  window.addEventListener('popstate', () => {
    const route = location.hash.replace('#', '');
    if (!route) backToExplore({ silent: true });
  });
}

function localPoint(e) {
  const r = app.mapEl.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function zoomAt(x, y, z) {
  zoomAround(app.cam, app.renderer.w, app.renderer.h, x, y, z);
  clampCamera(app.cam, app.world.bounds, app.renderer.w, app.renderer.h, 40);
  draw();
}

function onChromeClick(e) {
  const btn = e.target.closest('button');
  if (!btn) return;
  const act = btn.dataset.act;
  if (!act) return;
  onAct(act, btn.dataset, btn);
}

function onPanelClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.tagName === 'SELECT') return;
  onAct(btn.dataset.act, btn.dataset, btn);
}

function onPanelChange(e) {
  const el = e.target;
  if (el.id === 'saved-group') {
    setSavedGroup(el.dataset.id, el.value);
    toast('Moved to ' + getState().groups.find((g) => g.id === el.value).name);
  }
}

const saveNote = debounce((id, text) => {
  setNote(id, text);
  const el = $('#note-status');
  if (el) el.textContent = text.trim() ? 'Saved just now' : 'Private to this browser';
  const clear = $('[data-act="note-clear"]');
  if (clear) clear.hidden = !text.trim();
}, 450);

function onPanelKey(e) {
  const el = e.target;
  if (el.id !== 'search-input') return;
  if (e.key === 'Enter') {
    e.preventDefault();
    const first = app.world.search(app.view.query, { center: [app.cam.lon, app.cam.lat], limit: 1 })[0];
    if (!first) { toast('No match in the survey'); return; }
    if (first.kind === 'place') onAct('open-place', { id: first.item.id });
    else if (first.kind === 'station') onAct('open-station', { key: first.item.id });
    else if (first.kind === 'road') onAct('fly-road', { key: first.item.id });
  } else if (e.key === 'Escape') {
    el.value = '';
    app.view.query = '';
    app.view.name = 'explore';
    render();
    el.blur();
  }
}

function onPanelFocus(e) {
  const el = e.target;
  // A prefilled start or destination should be replaced by typing, not
  // appended to. Selecting the text makes that the default and is what
  // every address field on the web does.
  if (el.id === 'dir-from' || el.id === 'dir-to') el.select();
}

function onPanelInput(e) {
  const el = e.target;
  if (el.id === 'search-input') {
    app.view.query = el.value;
    app.view.name = el.value ? 'results' : 'explore';
    app.searchSel = -1;
    const body = $('#panel-body');
    const scroll = body ? body.scrollTop : 0;
    const list = $('#panel-body');
    if (list) {
      const tmp = document.createElement('div');
      tmp.innerHTML = app.view.name === 'results' ? resultsView(app.view, app) : exploreView(app.view, app);
      list.innerHTML = app.view.name === 'place' ? list.innerHTML : tmp.innerHTML;
      list.scrollTop = 0;
    }
    if (!el.value) render();
    return;
  }
  if (el.id === 'dir-from' || el.id === 'dir-to') {
    onDirInput(el);
    return;
  }

  if (el.id === 'place-note') {
    const n = el.value.length;
    const count = $('#note-count');
    if (count) count.textContent = n + '/600';
    saveNote(el.dataset.id, el.value);
    return;
  }
  if (el.id === 'hour-range') {
    const v = parseFloat(el.value);
    setHour(v);
    el.style.setProperty('--pct', ((v - 6) / 16) * 100 + '%');
    const badge = el.closest('.section')?.querySelector('.badge');
    if (badge) badge.textContent = hourLabel(v);
    updateRoute({ quiet: false });
  }
}

// ---------- actions ----------

async function onAct(act, data, el) {
  const s = getState();
  switch (act) {
    case 'home':
      backToExplore();
      break;
    case 'theme': {
      const order = ['auto', 'light', 'dark', 'contrast'];
      const next = order[(order.indexOf(s.settings.theme) + 1) % order.length];
      setSetting('theme', next);
      applyTheme();
      toast('Theme: ' + next);
      render();
      break;
    }
    case 'set-theme':
      setSetting('theme', data.theme);
      applyTheme();
      render();
      break;
    case 'settings':
      app.view.name = 'settings';
      render();
      break;
    case 'view':
      if (data.view === 'fixes') app.view.layers.quiet = true;
      app.view.name = data.view;
      render();
      break;
    case 'back':
      historyBack();
      break;
    case 'cat': {
      const cat = data.cat;
      app.view.name = 'category';
      app.view.cat = cat;
      app.view.query = '';
      const list = app.world.byCat.get(cat) || [];
      if (list.length) flyToBounds(boundsOf(list.map((p) => [p.lon, p.lat])), 40);
      render();
      break;
    }
    case 'clear-search':
      app.view.query = '';
      if (app.view.name === 'results') app.view.name = 'explore';
      render();
      $('#search-input')?.focus();
      break;
    case 'open-place': {
      const p = app.world.placesById.get(data.id);
      if (p) openPlace(p, { fly: true });
      break;
    }
    case 'toggle-save': {
      const p = app.world.placesById.get(data.id);
      if (!p) break;
      const now = toggleSaved(p);
      toast(now ? `Saved ${p.name}` : `Removed ${p.name}`);
      render();
      break;
    }
    case 'remove-saved': {
      const p = app.world.placesById.get(data.id);
      removeSaved(data.id);
      toast(`Removed ${p ? p.name : 'place'}`);
      render();
      break;
    }
    case 'field-card': {
      const p = app.world.placesById.get(data.id) || app.view.place;
      if (p) openCardModal(p);
      break;
    }
    case 'share-place': {
      const p = app.world.placesById.get(data.id);
      shareOrCopy(`${location.origin}${location.pathname}#place=${p.id}`, `${p.name} on Chowk`);
      break;
    }
    case 'note-clear': {
      const p = app.view.place;
      setNote(data.id, '');
      render();
      toast('Note cleared');
      break;
    }
    case 'directions-to': {
      const p = app.world.placesById.get(data.id);
      startDirections(null, p);
      break;
    }
    case 'pick-start':
    case 'origin-centre': {
      app.view.dir.origin = { name: 'Map centre', lon: app.cam.lon, lat: app.cam.lat };
      updateRoute({});
      render();
      break;
    }
    case 'origin-locate': {
      if (!navigator.geolocation) { toast('This browser has no location support'); break; }
      navigator.geolocation.getCurrentPosition((pos) => {
        app.view.dir.origin = { name: 'Your location', lon: pos.coords.longitude, lat: pos.coords.latitude };
        updateRoute({});
        render();
      }, () => toast('Location permission denied, pick a start another way'));
      break;
    }
    case 'swap': {
      const d = app.view.dir;
      [d.origin, d.destination] = [d.destination, d.origin];
      updateRoute({});
      render();
      break;
    }
    case 'quick-home': {
      const hom = s.settings.home;
      if (hom) { app.view.dir.origin = { name: hom.name, ...hom }; updateRoute({}); render(); }
      break;
    }
    case 'quick-work': {
      const w = s.settings.work;
      if (w) { app.view.dir.origin = { name: w.name, ...w }; updateRoute({}); render(); }
      break;
    }
    case 'mode': {
      setMode(data.mode);
      updateRoute({ clear: true });
      render();
      break;
    }
    case 'pick-route': {
      app.view.route.selected = parseInt(data.ix, 10);
      draw();
      render();
      break;
    }
    case 'toggle-layer': {
      const key = data.layer;
      app.view.layers[key] = !app.view.layers[key];
      if (key === 'accessibility') setSetting('accessibility', app.view.layers.accessibility);
      if (key === 'quiet') app.view.layers.busy = false;
      if (key === 'busy') app.view.layers.quiet = false;
      if (key === 'busy' && app.view.layers.busy) toast('Busy layer: drag the time slider in Directions');
      draw();
      render();
      break;
    }
    case 'toggle-setting': {
      const key = data.key;
      const value = !s.settings[key];
      setSetting(key, value);
      if (key === 'pixel') app.view.layers.pixel = value;
      if (key === 'accessibility') app.view.layers.accessibility = value;
      if (key === 'traffic') updateRoute({});
      draw();
      render();
      break;
    }
    case 'units':
      setSetting('units', data.units);
      updateScale();
      render();
      break;
    case 'add-stop': {
      toast('Right click the map to add a stop');
      app.view.awaitingStop = true;
      break;
    }
    case 'report-fix': {
      openFixModal(data.id || app.view.place?.id || null);
      break;
    }
    case 'fix-status':
      setFixStatus(data.id, data.status);
      render();
      break;
    case 'fix-goto': {
      const f = getState().fixes.find((x) => x.id === data.id);
      if (f && f.lon) flyTo(f.lon, f.lat, 17.4);
      break;
    }
    case 'nearby': {
      const p = app.world.placesById.get(data.id);
      if (!p) break;
      const near = app.world.nearby(p.lon, p.lat, { limit: 6, radius: 500 });
      flyToBounds(boundsOf([[p.lon, p.lat], ...near.map((r) => [r.p.lon, r.p.lat])]), 80);
      break;
    }
    case 'fly-road': {
      const road = app.world.roadGroups.get(data.key.replace('road:', ''));
      if (road) {
        const pts = road.flatMap((r) => r.ll);
        flyToBounds(boundsOf(pts), 60);
        toast('Street highlighted');
      }
      break;
    }
    case 'open-station': {
      const name = data.key.replace('metro:', '');
      const st = app.world.metroByName.get(name);
      if (st) flyTo(st.x, st.y, 16.4);
      break;
    }
    case 'home-here': {
      const p = app.world.placesById.get(data.id);
      setHome(p);
      toast(`${p.name} set as home`);
      render();
      break;
    }
    case 'work-here': {
      const p = app.world.placesById.get(data.id);
      setWork(p);
      toast(`${p.name} set as work`);
      render();
      break;
    }
    case 'new-list': {
      const name = prompt('Name the list');
      if (name) { addGroup(name, ['#0b6e4f', '#c2410c', '#7c5cbf', '#0f766e'][getState().groups.length % 4]); render(); }
      break;
    }
    case 'del-list':
      removeGroup(data.group);
      render();
      break;
    case 'export': {
      const blob = new Blob([exportAll()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'chowk-export.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Exported');
      break;
    }
    case 'reset-data':
      if (confirm('Delete every saved place, note and fix in this browser?')) {
        resetAll();
        applyTheme();
        backToExplore();
        toast('Everything reset');
      }
      break;
    case 'copy-route': {
      const r = app.view.route?.options?.[app.view.route.selected];
      if (!r) break;
      const text = [
        `Chowk route: ${app.view.dir.origin?.name} to ${app.view.dir.destination?.name}`,
        `${formatDistance(r.metres)} \u00b7 ${formatDuration(r.seconds)}`,
        ...(r.steps || []).map((st, i) => `${i + 1}. ${st.instruction}${st.metres ? ' (' + formatDistance(st.metres) + ')' : ''}`),
      ].join('\n');
      navigator.clipboard?.writeText(text).then(() => toast('Directions copied'), () => toast('Could not copy'));
      break;
    }
    case 'share-route': {
      const r = app.view.route?.options?.[app.view.route.selected];
      if (!r) break;
      const u = new URL(location.href);
      u.hash = `route=${app.view.dir.origin?.lon},${app.view.dir.origin?.lat},${app.view.dir.destination?.lon},${app.view.dir.destination?.lat}&mode=${r.mode}`;
      shareOrCopy(u.toString(), 'A route on Chowk');
      break;
    }
    case 'print-route':
      window.print();
      break;
    case 'add-contact': {
      const name = prompt('Which place? Name it as you know it');
      if (!name) break;
      addContact({ name, address: 'Bengaluru', note: 'Ask the staff about step free entry', placeId: app.view.place?.id || null });
      render();
      break;
    }
    case 'del-contact':
      removeContact(data.id);
      render();
      break;
    case 'tour':
      showTour();
      break;
    case 'shortcuts':
      showShortcuts();
      break;
    case 'list-view':
      showListView();
      break;
    case 'sheet':
      document.body.classList.toggle('sheet-tall');
      break;
    case 'recenter': {
      const { lon, lat } = app.cam;
      app.view.user = app.view.user || null;
      toast('Map centred');
      break;
    }
    case 'layers':
      showLayersPopover(el);
      break;
    case 'locate':
      locateMe();
      break;
    case 'zoom-in':
      zoomAt(app.renderer.w / 2, app.renderer.h / 2, app.cam.zoom + 1);
      break;
    case 'zoom-out':
      zoomAt(app.renderer.w / 2, app.renderer.h / 2, app.cam.zoom - 1);
      break;
    case 'fit':
      if (app.view.route?.options?.length) fitRoute();
      else {
        setCamera(app.cam, app.world.bounds.length ? (app.world.bounds[0] + app.world.bounds[2]) / 2 : app.cam.lon,
          (app.world.bounds[1] + app.world.bounds[3]) / 2, Math.max(app.cam.zoom, 16.6));
      }
      draw();
      break;
    case 'compass':
      app.view.layers.compass = false;
      draw();
      break;
    case 'measure':
      toggleMeasure();
      break;
    case 'palette':
      openPalette();
      break;
    case 'list':
      showListView();
      break;
    default:
      break;
  }
}

// ---------- routing ----------

function startDirections(origin, dest) {
  app.view.name = 'directions';
  app.view.dir = { origin: origin || app.view.dir.origin, destination: dest || app.view.dir.destination };
  if (!app.view.dir.origin && app.view.user) {
    app.view.dir.origin = { name: 'Your location', lon: app.view.user.lon, lat: app.view.user.lat };
  }
  updateRoute({});
  render();
}

function updateRoute({ clear = false } = {}) {
  const d = app.view.dir;
  const s = getState();
  if (!d.origin || !d.destination) {
    app.view.route = null;
    draw();
    return;
  }
  const mode = s.routePrefs.mode;
  const hour = s.routePrefs.hour;
  if (haversine(d.origin.lon, d.origin.lat, d.destination.lon, d.destination.lat) < 20) {
    app.view.route = null;
    draw();
    return;
  }
  let options = [];
  if (mode === 'transit') {
    options = transitOptions(app.router, app.world, [d.origin.lon, d.origin.lat], [d.destination.lon, d.destination.lat], { hour });
    options.forEach((o) => { o.kind = o.kind || 'fast'; });
  } else {
    options = app.router.options([d.origin.lon, d.origin.lat], [d.destination.lon, d.destination.lat], {
      mode, hour, destName: d.destination.name,
    });
    if (s.settings.traffic) {
      // apply the peak curve at the chosen hour for drive and bike
      options.forEach((o) => {
        const base = o.freeSeconds || o.seconds;
        const factor = o.mode === 'drive' ? 1 + 0.55 * peakAt(hour) : o.mode === 'bike' ? 1 + 0.15 * peakAt(hour) : 1;
        o.seconds = Math.round(base * factor);
      });
    } else {
      options.forEach((o) => { o.seconds = Math.round(o.freeSeconds || o.seconds); });
    }
  }
  const prev = app.view.route?.options?.[app.view.route.selected];
  let selected = 0;
  if (!clear && prev) {
    const ix = options.findIndex((o) => o.kind === prev.kind);
    if (ix >= 0) selected = ix;
  }
  app.view.route = options.length ? { options, selected } : null;
  if (app.view.route) fitRoute();
  draw();
}

function peakAt(hour) {
  const g = (h, mu, sigma) => Math.exp(-((h - mu) ** 2) / (2 * sigma * sigma));
  return Math.min(1, g(hour, 9.4, 2.1) + g(hour, 18.4, 2.3));
}

function fitRoute() {
  const r = app.view.route?.options?.[app.view.route.selected];
  if (!r || !r.geometry || r.geometry.length < 2) return;
  const pts = r.geometry.slice();
  if (app.view.dir.origin) pts.push([app.view.dir.origin.lon, app.view.dir.origin.lat]);
  if (app.view.dir.destination) pts.push([app.view.dir.destination.lon, app.view.dir.destination.lat]);
  const target = fitCamera(boundsOf(pts), app.renderer.w, app.renderer.h, 100, 17.2);
  setCamera(app.cam, target.lon, target.lat, Math.max(target.zoom, 15.3));
  clampCamera(app.cam, app.world.bounds, app.renderer.w, app.renderer.h, 40);
  draw();
}

function onDirInput(el) {
  // basic inline autocomplete for the two fields
  const q = el.value.trim();
  const box = el.parentElement.querySelector('.dir-suggest');
  if (box) box.remove();
  if (q.length < 2) return;
  const results = searchWorld(app.world, q, { limit: 5, center: [app.cam.lon, app.cam.lat] });
  if (!results.length) return;
  const suggest = document.createElement('div');
  suggest.className = 'dir-suggest ctx-menu';
  suggest.style.position = 'absolute';
  suggest.style.left = '30px';
  suggest.style.right = '8px';
  suggest.style.top = '100%';
  suggest.innerHTML = results.map((r) => `<button data-act="dir-pick" data-which="${el.id === 'dir-from' ? 'origin' : 'destination'}"
      data-lon="${r.lon}" data-lat="${r.lat}" data-name="${h(r.title)}">
      ${icon(r.kind === 'road' ? 'ruler' : r.kind === 'station' ? 'train' : catMeta(r.item.cat)?.icon || 'pin', 14)}
      <span>${h(r.title)}</span></button>`).join('');
  suggest.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act="dir-pick"]');
    if (!b) return;
    app.view.dir[b.dataset.which] = { name: b.dataset.name, lon: +b.dataset.lon, lat: +b.dataset.lat };
    el.value = b.dataset.name;
    el.blur();
    updateRoute({});
    render();
  });
  el.parentElement.style.position = 'relative';
  el.parentElement.appendChild(suggest);
}

// ---------- open place ----------

function openPlace(place, { fly = false } = {}) {
  app.view.name = 'place';
  app.view.place = place;
  app.view.selected = place.id;
  pushRecent(place.id);
  if (fly) flyTo(place.lon, place.lat, Math.max(16.6, app.cam.zoom));
  else draw();
  render();
  if (window.innerWidth <= 860) document.body.classList.add('sheet-tall');
}

function backToExplore({ silent = false } = {}) {
  app.view.name = 'explore';
  app.view.place = null;
  app.view.selected = null;
  app.view.route = null;
  app.view.dir = { origin: null, destination: null };
  app.view.query = '';
  app.view.cat = null;
  if (!silent) render();
  else render();
}

function historyBack() {
  render();
}

// ---------- camera movement ----------

let anim = null;
function flyTo(lon, lat, zoom, { ms = 420 } = {}) {
  if (anim) cancelAnimationFrame(anim.raf);
  const from = { lon: app.cam.lon, lat: app.cam.lat, zoom: app.cam.zoom };
  const to = { lon, lat, zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM) };
  const start = performance.now();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = reduce ? 0 : ms;
  const step = (t) => {
    const k = dur ? clamp((t - start) / dur, 0, 1) : 1;
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  setCamera(app.cam, from.lon + (to.lon - from.lon) * e, from.lat + (to.lat - from.lat) * e, from.zoom + (to.zoom - from.zoom) * e);
    clampCamera(app.cam, app.world.bounds, app.renderer.w, app.renderer.h, 40);
    draw();
    if (k < 1) anim = { raf: requestAnimationFrame(step) };
  };
  anim = { raf: requestAnimationFrame(step) };
}

function flyToBounds(bounds, pad = 60, opts = {}) {
  const target = fitCamera(bounds, app.renderer.w, app.renderer.h, pad, 18);
  if (opts.instant) {
    setCamera(app.cam, target.lon, target.lat, target.zoom);
    draw();
    return;
  }
  flyTo(target.lon, target.lat, target.zoom);
}

function boundsOf(points) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of points) {
    a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y);
  }
  return [a, b, c, d];
}

// ---------- tooltip, context menu ----------

function showTooltip(hit, x, y) {
  const tip = $('#tooltip');
  if (!hit) { hideTooltip(); return; }
  const p = hit.place;
  if (!p) { hideTooltip(); return; }
  const meta = catMeta(p.cat);
  tip.innerHTML = `<b>${h(p.name)}</b><span>${h(p.kindLabel)} \u00b7 ${h(meta.short)}</span>`;
  tip.style.left = hit.x + 'px';
  tip.style.top = hit.y + 'px';
  tip.classList.add('show');
}
function hideTooltip() {
  $('#tooltip')?.classList.remove('show');
}

function closeMenus() {
  $$('.ctx-menu, .tooltip').forEach((el) => { if (el.id !== 'tooltip') el.remove(); });
  hideTooltip();
}

function openContextMenu(x, y, ll) {
  closeMenus();
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.style.left = Math.min(x, app.renderer.w - 230) + 'px';
  menu.style.top = Math.min(y, app.renderer.h - 260) + 'px';
  const road = app.renderer.roadAt(x, y, app.cam, app.renderer.w, app.renderer.h, 7);
  const hits = app.world.nearby(ll.lon, ll.lat, { limit: 1, radius: 90 });
  menu.innerHTML = `
    <div class="ctx-coord">${ll.lat.toFixed(5)}, ${ll.lon.toFixed(5)}<br>${road ? h(road.name) : 'Unnamed street'}</div>
    <div class="sep"></div>
    <button data-act="ctx-origin">${icon('navigate', 14)} Start from here</button>
    <button data-act="ctx-dest">${icon('flag', 14)} Go here</button>
    <button data-act="ctx-measure">${icon('ruler', 14)} Measure distance</button>
    <button data-act="ctx-fix">${icon('warning', 14)} Report a fix here</button>
    ${hits.length ? `<div class="sep"></div><button data-act="ctx-open" data-id="${hits[0].p.id}">${icon('pin', 14)} Open ${h(hits[0].p.name)}</button>` : ''}
    <div class="sep"></div>
    <button data-act="ctx-copy">${icon('copy', 14)} Copy coordinates</button>`;
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    menu.remove();
    if (act === 'ctx-origin') {
      app.view.dir.origin = { name: road ? road.name : 'Dropped pin', lon: ll.lon, lat: ll.lat };
      if (app.view.name !== 'directions') startDirections(app.view.dir.origin, app.view.dir.destination);
      else { updateRoute({}); render(); }
    } else if (act === 'ctx-dest') {
      app.view.dir.destination = { name: road ? road.name : 'Dropped pin', lon: ll.lon, lat: ll.lat };
      app.view.name = 'directions';
      updateRoute({});
      render();
    } else if (act === 'ctx-measure') {
      beginMeasure(ll);
    } else if (act === 'ctx-fix') {
      openFixModal(null, ll);
    } else if (act === 'ctx-open') {
      openPlace(app.world.placesById.get(b.dataset.id), { fly: true });
    } else if (act === 'ctx-copy') {
      navigator.clipboard?.writeText(`${ll.lat.toFixed(6)}, ${ll.lon.toFixed(6)}`).then(() => toast('Coordinates copied'));
    }
  });
  $('#map-layer').appendChild(menu);
}

// ---------- measure ----------

function toggleMeasure() {
  if (app.view.measure) {
    app.view.measure = null;
    app.mapEl.classList.remove('crosshair');
    toast('Measuring off');
  } else {
    app.view.measure = { points: [], cursor: null };
    app.mapEl.classList.add('crosshair');
    toast('Tap the map to measure distances');
  }
  draw();
}

function beginMeasure(ll) {
  app.view.measure = { points: [[ll.lon, ll.lat]], cursor: null };
  app.mapEl.classList.add('crosshair');
  draw();
}

// ---------- locate ----------

function locateMe() {
  if (!navigator.geolocation) { toast('This browser has no location support'); return; }
  toast('Finding you');
  navigator.geolocation.getCurrentPosition((pos) => {
    const { longitude: lon, latitude: lat, accuracy } = pos.coords;
    app.view.user = { lon, lat, accuracy };
    flyTo(lon, lat, 16.5);
    const inside = lon >= app.world.bounds[0] && lon <= app.world.bounds[2] && lat >= app.world.bounds[1] && lat <= app.world.bounds[3];
    toast(inside ? 'You are inside the survey area' : 'You are outside the Bengaluru survey area, so the map stays where it is');
    if (!inside) app.view.user = null;
    draw();
  }, () => toast('Location permission denied, no problem'), { timeout: 8000, maximumAge: 60000 });
}

// ---------- modals ----------

function modal(html, { narrow = false, onMount } = {}) {
  const scrim = document.createElement('div');
  scrim.className = 'modal-scrim';
  scrim.innerHTML = `<div class="modal ${narrow ? 'narrow' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(scrim);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', esc);
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) close();
    if (e.target.closest('[data-close]')) close();
  });
  onMount?.(scrim.querySelector('.modal'), close);
  return { el: scrim, close };
}

function openFixModal(placeId, ll = null) {
  const place = placeId ? app.world.placesById.get(placeId) : app.view.place;
  const coords = ll || (place ? { lon: place.lon, lat: place.lat } : { lon: app.cam.lon, lat: app.cam.lat });
  const name = place?.name || 'Dropped pin near the map centre';
  const { close } = modal(`
    <div class="modal-head">
      <div><div class="eyebrow">Fixes layer</div><div class="modal-title">Report a fix</div></div>
      <button class="icon-btn" data-close aria-label="Close">${icon('close', 18)}</button>
    </div>
    <div class="modal-body">
      <p class="lede" style="margin-bottom:14px">Reports are stored in this browser and drawn on the map. Nothing is sent to a server.</p>
      <div class="field"><label>Where</label>
        <input type="text" id="fix-where" value="${h(name)}" readonly></div>
      <div class="field"><label>What is wrong</label>
        <select id="fix-issue">${ISSUE_LIST.map((i) => `<option value="${i.id}">${i.label}</option>`).join('')}</select></div>
      <div class="field"><label>Detail, optional</label>
        <input type="text" id="fix-detail" placeholder="Two street lights out past the bus stop" maxlength="300"></div>
      <div class="field"><label>Reported as</label>
        <select id="fix-as"><option value="reported">New report</option><option value="acknowledged">Already known</option></select></div>
    </div>
    <div class="modal-foot">
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="fix-save">${icon('check', 15)} Add to the map</button>
    </div>`, { narrow: true, onMount: (root, closeFn) => {
      root.querySelector('#fix-save').addEventListener('click', () => {
        const issue = root.querySelector('#fix-issue').value;
        reportFix({
          placeId: place?.id || 'pin-' + uid(), name: root.querySelector('#fix-where').value,
          issue, detail: root.querySelector('#fix-detail').value,
          lon: coords.lon, lat: coords.lat,
        });
        closeFn();
        toast(ISSUES[issue].label + ' added to the map');
        if (app.view.name !== 'fixes') { app.view.name = 'fixes'; }
        app.view.layers.quiet = true;
        render();
      });
    } });
}

function openCardModal(place) {
  const note = getNote(place.id)?.text || '';
  let accent = 'forest';
  const { el, close } = modal(`
    <div class="modal-head">
      <div><div class="eyebrow">New in Chowk</div><div class="modal-title">Field card</div></div>
      <button class="icon-btn" data-close aria-label="Close">${icon('close', 18)}</button>
    </div>
    <div class="modal-body">
      <div class="poster-layout">
        <div class="poster-preview"><canvas id="card-canvas" aria-label="Preview of the field card for ${h(place.name)}"></canvas></div>
        <div>
          <p class="lede" style="margin-bottom:16px">A one page card for the place: what it is, when it is open, how calm the street is, and your note. Download it as a PNG or print it.</p>
          <div class="field">
            <label for="card-accent">Ink</label>
            <div class="swatches" id="card-accent">
              ${CARD_ACCENTS.map((a, i) => `<button class="swatch-btn" data-accent="${a.id}" aria-pressed="${i === 0}"
                aria-label="${a.label}" style="background:${a.bg}"><i style="background:${a.accent}"></i></button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label for="card-note">Note on the card</label>
            <textarea id="card-note" maxlength="220" placeholder="Write what you found. Leave it empty to use the survey note."
              style="width:100%;min-height:76px;border:1px solid var(--c-border);border-radius:var(--r-sm);background:var(--c-surface);padding:9px;font-size:var(--text-sm);resize:vertical">${h(note)}</textarea>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn primary" id="card-download">${icon('download', 15)} Download PNG</button>
            <button class="btn" id="card-print">${icon('printer', 15)} Print</button>
          </div>
          <p class="lede" style="margin-top:12px;font-size:var(--text-xs)">Cards carry the survey attribution. Your note stays in this browser unless you share the card.</p>
        </div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>Done</button></div>`,
    { onMount: (root) => {
      const canvas = root.querySelector('#card-canvas');
      const paint = () => {
        const text = root.querySelector('#card-note').value.trim();
        drawCard(canvas, { place, note: text, world: app.world, accentId: accent });
      };
      paint();
      root.querySelector('#card-note').addEventListener('input', paint);
      root.querySelectorAll('[data-accent]').forEach((b) => b.addEventListener('click', () => {
        accent = b.dataset.accent;
        root.querySelectorAll('[data-accent]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        paint();
      }));
      root.querySelector('#card-download').addEventListener('click', () => {
        const a = document.createElement('a');
        a.download = 'chowk-' + place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        toast('Field card downloaded');
      });
      root.querySelector('#card-print').addEventListener('click', () => {
        const url = canvas.toDataURL('image/png');
        const w = window.open('', '_blank');
        if (!w) { toast('Allow pop ups to print the card'); return; }
        w.document.write(`<title>${h(place.name)} field card</title><body style="margin:0;display:grid;place-items:center;background:#fff"><img src="${url}" style="width:100%;max-width:760px" onload="window.print()">`);
        w.document.close();
      });
    } });
}

function showLayersPopover(anchor) {
  closeMenus();
  const s = getState();
  const items = [
    ['quiet', 'waves', 'Quiet streets', 'Green is calm, orange is loud'],
    ['busy', 'therm', 'Busy by time of day', 'Places fill up, follow the hour'],
    ['transit', 'train', 'Metro lines and stations', 'Purple and Green lines'],
    ['parks', 'tree', 'Parks and water', 'Open green space'],
    ['accessibility', 'wheelchair', 'Step free places', 'Wheelchair tag only'],
    ['pixel', 'grid', 'Pixel map', 'Low resolution mode'],
    ['compass', 'compass', 'Compass', 'Show the compass tool'],
  ];
  const pop = document.createElement('div');
  pop.className = 'ctx-menu';
  pop.style.position = 'absolute';
  const r = anchor.getBoundingClientRect();
  const m = app.mapEl.getBoundingClientRect();
  pop.style.left = Math.min(r.right - m.left - 230, m.width - 240) + 'px';
  pop.style.top = (r.bottom - m.top + 8) + 'px';
  pop.style.minWidth = '228px';
  pop.innerHTML = `<div class="ctx-coord">Map layers</div><div class="sep"></div>` + items.map(([k, ic, label, sub]) => `
    <button data-layer="${k}"><span style="width:16px">${s.settings[k] !== undefined && k === 'pixel' ? icon(s.settings.pixel ? 'check' : 'grid', 15) : icon(app.view.layers[k] ? 'check' : ic, 15)}</span>
      <span style="flex:1"><span style="display:block">${label}</span><span style="display:block;font-size:11px;color:var(--c-text-muted)">${sub}</span></span></button>`).join('');
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-layer]');
    if (!b) return;
    onAct('toggle-layer', { layer: b.dataset.layer });
    pop.remove();
    showLayersPopover(anchor);
  });
  $('#map-layer').appendChild(pop);
}

function printMap() {
  const cv = document.getElementById('map');
  if (!cv) return;
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop ups to print the map'); return; }
  const url = cv.toDataURL('image/png');
  const centre = `${app.cam.lon.toFixed(4)}, ${app.cam.lat.toFixed(4)}`;
  const mode = app.view.name === 'directions' ? ' with the current route' : '';
  const title = `Chowk survey${mode}`;
  w.document.write(`<!doctype html><title>${title}</title>
  <body style="margin:0;padding:28px 28px 20px;font-family:Georgia,serif;color:#1d1b16;background:#fff">
    <div style="max-width:920px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #d8d0bd;padding-bottom:10px;margin-bottom:14px">
        <div style="font-size:26px;letter-spacing:.01em">Chowk</div>
        <div style="font:12px/1.4 system-ui;color:#6b6355;text-align:right">${h(app.world.meta.area)}<br>Centre ${centre}<br>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <img src="${url}" style="width:100%;display:block;border:1px solid #d8d0bd">
      <div style="display:flex;justify-content:space-between;gap:24px;margin-top:10px;font:11px/1.5 system-ui;color:#6b6355">
        <div>Survey data OpenStreetMap contributors, ODbL 1.0. Drawn from the data, no map tiles.</div>
        <div>${mode ? 'Route shown as drawn in the app.' : 'North is up.'} Not for navigation.</div>
      </div>
    </div>
    <script>window.onload = () => window.print()</script>`);
  w.document.close();
}

function showShortcuts() {
  const rows = [
    ['Search', '/'], ['Open the command palette', 'Ctrl K'],
    ['Zoom in / out', '+ / -'], ['Fit the survey', '0'],
    ['Toggle pixel map', 'P'], ['Toggle quiet layer', 'Q'],
    ['Toggle busy layer', 'B'], ['Toggle step free', 'A'],
    ['Measure distance', 'M'], ['Find my location', 'L'],
    ['Cycle theme', 'T'], ['Close overlay', 'Esc'],
    ['Pan the map', 'arrow keys'], ['Open list view', 'Shift L'],
  ];
  modal(`<div class="modal-head"><div class="modal-title">Keyboard</div>
    <button class="icon-btn" data-close aria-label="Close">${icon('close', 18)}</button></div>
    <div class="modal-body"><div class="shortcut-grid">
      ${rows.map(([label, key]) => `<div class="shortcut"><span>${label}</span><kbd>${key}</kbd></div>`).join('')}
    </div></div>`, { narrow: true });
}

function showTour() {
  const steps = [
    ['quiet', 'Quiet streets', 'Every street segment carries a noise estimate. Turn the layer on, or ask for the quietest route instead of the fastest.'],
    ['fixes', 'The fixes layer', 'Report broken pavements, unsafe crossings and entrances without ramps. They stay on the map until someone marks them fixed.'],
    ['notes', 'Notes on places', 'Write down what the listing does not say: the queue at 6 pm, the step at the door, the entrance behind the block. Notes save as you type.'],
    ['time', 'Busy by time of day', 'Scrub the hour in Directions and the drive times and the busy layer follow a typical weekday curve.'],
    ['access', 'Step free routing', 'Ask for routes without steps, and filter the map to places tagged step free.'],
  ];
  const { el, close } = modal(`<div class="modal-head">
      <div><div class="eyebrow">A two minute tour</div><div class="modal-title">What Chowk adds</div></div>
      <button class="icon-btn" data-close aria-label="Close">${icon('close', 18)}</button></div>
    <div class="modal-body" id="tour-body"></div>
    <div class="modal-foot"><button class="btn" data-close>Close</button>
      <button class="btn primary" id="tour-next">Next</button></div>`, { narrow: true });
  let i = 0;
  const paint = () => {
    const [k, title, body] = steps[i];
    el.querySelector('#tour-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span class="tile-icon" style="--cat-color:var(--c-accent);width:36px;height:36px">${icon(k === 'quiet' ? 'waves' : k === 'fixes' ? 'warning' : k === 'notes' ? 'note' : k === 'time' ? 'therm' : 'wheelchair', 18)}</span>
        <div><div class="eyebrow">Step ${i + 1} of ${steps.length}</div><div style="font-family:var(--font-display);font-size:20px;font-weight:600">${title}</div></div>
      </div>
      <p class="lede" style="font-size:var(--text-md);line-height:1.6">${body}</p>`;
    el.querySelector('#tour-next').textContent = i === steps.length - 1 ? 'Start exploring' : 'Next';
  };
  paint();
  el.querySelector('#tour-next').addEventListener('click', () => {
    if (i === steps.length - 1) {
      close();
      app.view.layers.quiet = true;
      app.view.name = 'fixes';
      render();
      toast('Fixes layer on, right click the map to add one');
    } else { i++; paint(); }
  });
}

function maybeTour() {
  if (!localStorage.getItem('chowk.tour')) {
    localStorage.setItem('chowk.tour', '1');
    setTimeout(showTour, 700);
  }
}

function openPalette() {
  const input = `<input type="text" placeholder="Search places, streets, stations or run a command" aria-label="Command palette" style="flex:1">`;
  const { el, close } = modal(`<div class="palette" style="margin-top:-8vh">
      <div class="palette-input">${icon('search', 18)}${input}<span class="kbd">Esc</span></div>
      <div class="palette-list" role="listbox"></div>
      <div class="palette-foot"><span>Enter to open</span><span>Up and down to move</span><span>Ctrl K any time</span></div>
    </div>`, { onMount: (root) => {
    const inp = root.querySelector('input');
    const list = root.querySelector('.palette-list');
    let items = [];
    let sel = 0;
    const commands = [
      ['Quiet streets layer', 'waves', () => onAct('toggle-layer', { layer: 'quiet' })],
      ['Busy by time of day', 'therm', () => onAct('toggle-layer', { layer: 'busy' })],
      ['Step free only', 'wheelchair', () => onAct('toggle-layer', { layer: 'accessibility' })],
      ['Pixel map', 'grid', () => onAct('toggle-setting', { key: 'pixel' })],
      ['Measure distance', 'ruler', () => toggleMeasure()],
      ['Find my location', 'locate', () => locateMe()],
      ['Saved and noted', 'bookmark', () => { app.view.name = 'saved'; render(); }],
      ['The fixes layer', 'warning', () => { app.view.name = 'fixes'; render(); }],
      ['Settings', 'dotdotdot', () => { app.view.name = 'settings'; render(); }],
      ['Keyboard shortcuts', 'keyboard', () => showShortcuts()],
      ['Print the map', 'printer', () => printMap()],
      ['Export my data', 'download', () => onAct('export', {})],
    ];
    const paint = () => {
      const q = inp.value.trim();
      const places = q ? searchWorld(app.world, q, { limit: 7, center: [app.cam.lon, app.cam.lat] }) : [];
      const cmds = commands.filter(([label]) => !q || label.toLowerCase().includes(q.toLowerCase()));
      items = [
        ...places.map((r) => ({ kind: r.kind, title: r.title,
          sub: r.kind === 'place' ? [r.sub, r.item.tags?.road || r.item.tags?.suburb].filter(Boolean).join(' \u00b7 ') : r.sub,
          run: () => {
          if (r.kind === 'place') openPlace(app.world.placesById.get(r.item.id), { fly: true });
          else if (r.kind === 'road') onAct('fly-road', { key: r.item.id });
          else onAct('open-station', { key: r.item.id });
        } })),
        ...cmds.map(([label, ic, run]) => ({ kind: 'cmd', icon: ic, title: label, sub: 'Command', run })),
      ];
      sel = clamp(sel, 0, Math.max(0, items.length - 1));
      list.innerHTML = items.length ? items.map((it, i) => `
        <button class="palette-item" data-ix="${i}" aria-selected="${i === sel}" role="option">
          <span class="pi-icon">${icon(it.icon || (it.kind === 'place' ? catMeta(it.item?.cat || 'civic').icon : it.kind === 'road' ? 'ruler' : 'train'), 15)}</span>
          <span class="pi-main"><span class="pi-title">${h(it.title)}</span><span class="pi-sub">${h(it.sub)}</span></span>
          ${i === sel ? `<span class="kbd">Enter</span>` : ''}
        </button>`).join('') : `<div class="empty-state" style="padding:24px"><h3>Nothing found</h3><p>Try a street or a command name.</p></div>`;
    };
    const run = () => {
      const it = items[sel];
      if (!it) return;
      close();
      it.run();
    };
    inp.addEventListener('input', () => { sel = 0; paint(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); paint(); scrollSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); scrollSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(); }
    });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ix]');
      if (!b) return;
      sel = +b.dataset.ix;
      run();
    });
    const scrollSel = () => list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
    paint();
    inp.focus();
  } });
}

function showListView() {
  const rows = [...app.world.places]
    .sort((a, b) => haversine(app.cam.lon, app.cam.lat, a.lon, a.lat) - haversine(app.cam.lon, app.cam.lat, b.lon, b.lat))
    .slice(0, 80);
  const overlay = document.createElement('div');
  overlay.className = 'listview';
  overlay.innerHTML = `
    <div class="listview-head">
      <div><div class="eyebrow">List view</div><div class="modal-title">Every place, nearest first</div></div>
      <div style="display:flex;gap:8px">
        <button class="btn sm" data-close>${icon('close', 14)} Close</button>
      </div>
    </div>
    <div class="listview-body">
      <table>
        <thead><tr><th>Place</th><th>Kind</th><th>Distance</th><th>Calm</th></tr></thead>
        <tbody>${rows.map((p) => {
          const q = quietScore(p);
          return `<tr><td><a href="#" data-id="${p.id}">${h(p.name)}</a></td><td>${h(p.kindLabel)}</td>
            <td>${formatDistance(haversine(app.cam.lon, app.cam.lat, p.lon, p.lat))}</td><td>${q}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) overlay.remove();
    const a = e.target.closest('a[data-id]');
    if (a) {
      e.preventDefault();
      overlay.remove();
      openPlace(app.world.placesById.get(a.dataset.id), { fly: true });
    }
  });
  $('#map-layer').appendChild(overlay);
}

function shareOrCopy(url, title) {
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).then(() => toast('Link copied'), () => toast('Could not copy'));
  }
}

// ---------- toast ----------

let toastTimer;
function toast(message, { icon: ic = 'check', ms = 2600 } = {}) {
  const wrap = $('#toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon(ic, 15)} <span>${h(message)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, ms);
  while (wrap.children.length > 3) wrap.firstChild.remove();
}

// ---------- keyboard ----------

function onKey(e) {
  const tag = document.activeElement?.tagName;
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPalette();
    return;
  }
  if (e.key === 'Escape') {
    closeMenus();
    if (app.view.measure) { app.view.measure = null; app.mapEl.classList.remove('crosshair'); draw(); }
    if (document.body.classList.contains('sheet-tall')) document.body.classList.remove('sheet-tall');
    if (typing) document.activeElement.blur();
    return;
  }
  if (typing) return;
  const k = e.key.toLowerCase();
  if (e.key === '/') { e.preventDefault(); $('#search-input')?.focus(); }
  else if (k === '+' || k === '=') zoomAt(app.renderer.w / 2, app.renderer.h / 2, app.cam.zoom + 1);
  else if (k === '-') zoomAt(app.renderer.w / 2, app.renderer.h / 2, app.cam.zoom - 1);
  else if (k === '0') onAct('fit', {});
  else if (k === 'p') onAct('toggle-setting', { key: 'pixel' });
  else if (k === 'q') onAct('toggle-layer', { layer: 'quiet' });
  else if (k === 'b') onAct('toggle-layer', { layer: 'busy' });
  else if (k === 'a') onAct('toggle-layer', { layer: 'accessibility' });
  else if (k === 'm') toggleMeasure();
  else if (k === 'l' && !e.shiftKey) locateMe();
  else if (k === 'L') showListView();
  else if (k === 't') onAct('theme', {});
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const step = 90;
    const d = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [step, 0], ArrowRight: [-step, 0] }[e.key];
    panBy(app.cam, d[0], d[1]);
    draw();
  }
}

// ---------- store ----------

function wireStore() {
  subscribe((topic) => {
    if (topic === 'settings') {
      applyTheme();
      draw();
    }
  });
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getState().settings.theme === 'auto') { applyTheme(); draw(); }
  });
}

// ---------- hash routing ----------

function syncHash() {
  const parts = [];
  if (app.view.name === 'place' && app.view.place) parts.push('place=' + app.view.place.id);
  if (app.view.name === 'directions' && app.view.dir.origin && app.view.dir.destination) {
    parts.push(`dir=${app.view.dir.origin.lon},${app.view.dir.origin.lat},${app.view.dir.destination.lon},${app.view.dir.destination.lat}`);
  }
  const hash = parts.length ? '#' + parts.join('&') : '';
  if (hash && location.hash !== hash) history.replaceState(null, '', hash);
  if (!hash && location.hash) history.replaceState(null, '', location.pathname + location.search);
}

// ---------- bind dynamic inputs ----------

function bindInputs() {
  // measured in render(); keeping this for future inputs
}

window.addEventListener('DOMContentLoaded', boot);

export { app, toast, openFixModal };
