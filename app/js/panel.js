// Panel views: explore, place, directions, saved, fixes, settings.

import { icon, catMeta, CATS, CAT_ORDER } from './icons.js';
import {
  escapeHtml as h, formatDistance as fmtD, formatDuration as fmtT, formatClock, formatMoney,
  haversine, clamp, uid,
} from './geo.js';
import { categoryList } from './data.js';
import {
  addressLines, addressOneLine, kindLine, openState, hoursTable, todayIndex, DAY_SHORT, cap,
  cuisineList,
} from './place.js';
import {
  getState, isSaved, toggleSaved, removeSaved, savedEntry, getNote, setNote, addGroup, removeGroup,
  setHome, setWork, noteCount, addContact, removeContact, fixCount, setContactStatus,
} from './store.js';
import { ISSUE_LIST, ISSUES, fixesFor, quietScore, quietLabel, guideNote, openFixCount } from './fixes.js';

const POPULAR = ['food', 'cafe', 'culture', 'park', 'shop', 'transit'];
const CHIP_CATS = ['food', 'cafe', 'culture', 'park', 'shop', 'transit'];

export function masthead(state, app) {
  const s = getState();
  return `
  <header class="masthead">
    <button class="brand" data-act="home" aria-label="Chowk, back to explore">
      <span class="brand-mark">${icon('pin', 18)}</span>
      <span>
        <span class="brand-name">Chowk</span>
        <span class="brand-tag">${h(app.world.meta.area)}</span>
      </span>
    </button>
    <div class="masthead-actions">
      <button class="icon-btn" data-act="theme" aria-label="Switch theme, currently ${h(s.settings.theme)}" title="Theme (T)">${icon(themeIcon(s.settings.theme), 18)}</button>
      <button class="icon-btn" data-act="settings" aria-label="Settings" title="Settings">${icon('dotdotdot', 18)}</button>
    </div>
  </header>`;
}

function themeIcon(theme) {
  return theme === 'dark' ? 'moon' : theme === 'contrast' ? 'contrast' : theme === 'light' ? 'sun' : 'sun';
}

export function searchBar(view, app) {
  const q = view.query || '';
  return `
  <div class="search-wrap">
    <div class="search" role="search">
      <span class="search-icon">${icon('search', 18)}</span>
      <input id="search-input" type="search" placeholder="Search shops, streets, stations" value="${h(q)}"
        autocomplete="off" spellcheck="false" aria-label="Search places and streets"
        aria-controls="search-results" aria-expanded="${view.searchOpen ? 'true' : 'false'}" aria-autocomplete="list">
      ${q ? `<button class="clear-btn" data-act="clear-search" aria-label="Clear search">${icon('close', 14)}</button>` : `<span class="kbd">/</span>`}
    </div>
    <div id="search-results" role="listbox" aria-label="Search results" hidden></div>
  </div>`;
}

export function chips(view, app, activeCat) {
  return `
  <div class="chips" role="group" aria-label="Browse by category">
    ${CHIP_CATS.map((c) => {
      const meta = catMeta(c);
      return `<button class="chip" data-act="cat" data-cat="${c}" aria-pressed="${activeCat === c}"
        style="--cat-color:${meta.color}"><span class="cat-dot"></span>${meta.short}</button>`;
    }).join('')}
    <button class="chip" data-act="view" data-view="fixes" aria-pressed="${view.name === 'fixes'}">
      ${icon('warning', 13)} Fixes${fixCount() ? ` (${fixCount()})` : ''}
    </button>
  </div>`;
}

export function exploreView(view, app) {
  const s = getState();
  const center = [app.cam.lon, app.cam.lat];
  const recent = s.recent.map((id) => app.world.placesById.get(id)).filter(Boolean).slice(0, 3);
  const saved = s.saved.slice(0, 3).map((x) => ({ x, p: app.world.placesById.get(x.placeId) })).filter((o) => o.p);
  const near = app.world.nearby(center[0], center[1], { limit: 4, radius: 800, cats: ['food', 'culture', 'park', 'shop', 'cafe'] });
  return `
  <div class="section">
    <div class="section-head"><span class="eyebrow">Around you</span>
      <button class="link-btn" data-act="recenter">Centre map</button></div>
    <div class="tiles">
      ${POPULAR.map((c) => {
        const meta = catMeta(c);
        const n = app.world.catCounts[c] || 0;
        return `<button class="tile" data-act="cat" data-cat="${c}" style="--cat-color:${meta.color}">
          <span class="tile-icon">${icon(meta.icon, 16)}</span>
          <span class="tile-label">${meta.short}</span>
          <span class="tile-sub">${n} nearby</span>
        </button>`;
      }).join('')}
    </div>
  </div>
  ${near.length ? `
  <div class="section">
    <div class="section-head"><span class="eyebrow">Closest to the centre</span></div>
    <div class="result-list">
      ${near.map(({ p, d }) => resultRow(p, { distance: d, app })).join('')}
    </div>
  </div>` : ''}
  ${saved.length ? `
  <div class="section">
    <div class="section-head"><span class="eyebrow">Saved</span>
      <button class="link-btn" data-act="view" data-view="saved">All ${s.saved.length} saved</button></div>
    <div class="result-list">
      ${saved.map(({ x, p }) => {
        const note = getNote(p.id);
        return resultRow(p, { app, note: note?.text, group: s.groups.find((g) => g.id === x.group) });
      }).join('')}
    </div>
  </div>` : `
  <div class="section">
    <div class="empty-state" style="padding:22px 12px">
      <div class="empty-icon">${icon('bookmark', 20)}</div>
      <h3>Nothing saved yet</h3>
      <p>Open a place and tap Save. Saved places stay in this browser and work offline.</p>
    </div>
  </div>`}
  ${recent.length ? `
  <div class="section">
    <div class="section-head"><span class="eyebrow">Recently viewed</span></div>
    ${recent.map((p) => `<button class="result" data-act="open-place" data-id="${p.id}">
      <span class="result-icon" style="--cat-color:${catMeta(p.cat).color}">${icon(catMeta(p.cat).icon, 17)}</span>
      <span class="result-main"><span class="result-name">${h(p.name)}</span>
        <span class="result-meta">${h(p.kindLabel)}</span></span>
      <span class="result-side">${icon('chevronRight', 14)}</span>
    </button>`).join('')}
  </div>` : ''}
  <div class="section">
    <hr class="hr">
    <div style="padding-top:14px">
      <div class="eyebrow" style="margin-bottom:6px">Make it yours</div>
      <p class="lede">Chowk adds things a map usually forgets: quiet routes, a fixes layer for broken footpaths, and a place to write down what you actually found.</p>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn sm" data-act="view" data-view="fixes">${icon('warning', 14)} Open the fixes layer</button>
        <button class="btn sm" data-act="tour">${icon('sparkle', 14)} What is new</button>
      </div>
    </div>
  </div>`;
}

export function catView(view, app, cat) {
  const meta = catMeta(cat);
  const s = getState();
  const center = [app.cam.lon, app.cam.lat];
  const list = categoryList(app.world, cat, { center, limit: 40 });
  const savedIds = new Set(s.saved.map((x) => x.placeId));
  return `
  <div class="section">
    <div class="section-head">
      <div>
        <span class="eyebrow">${meta.label} \u00b7 ${list.length} in the survey</span>
        <h2 class="section-title" style="margin-top:2px">${meta.plural.charAt(0).toUpperCase() + meta.plural.slice(1)}</h2>
      </div>
    </div>
    <p class="lede">Sorted by distance from the map centre. ${savedIds.size ? `${savedIds.size} already saved.` : ''}</p>
  </div>
  <div class="section">
    <div class="result-list">
      ${list.length ? list.map((r) => resultRow(r.item, { distance: r.distance, app, saved: savedIds.has(r.item.id) })).join('')
        : `<div class="empty-state"><div class="empty-icon">${icon(meta.icon, 20)}</div><h3>Nothing in this category</h3><p>This survey covers central Bengaluru only.</p></div>`}
    </div>
  </div>`;
}

export function resultsView(view, app) {
  const center = [app.cam.lon, app.cam.lat];
  const results = app.world.search(view.query, { center, limit: 30 });
  if (!view.query) return exploreView(view, app);
  const q = view.query.trim().toLowerCase();
  const catMatch = CAT_ORDER.find((c) => {
    const m = catMeta(c);
    return [m.label, m.short, m.plural, c].some((v) => v.toLowerCase() === q);
  });
  const catMetaHit = catMatch ? catMeta(catMatch) : null;
  return `
  <div class="section">
    <div class="section-head">
      <span class="eyebrow">${results.length} result${results.length === 1 ? '' : 's'} for</span>
    </div>
    <h2 class="section-title" style="margin-bottom:10px">\u201c${h(view.query)}\u201d</h2>
    ${catMetaHit ? `<button class="btn" data-act="cat" data-cat="${catMatch}" style="justify-content:flex-start">
      <span style="--cat-color:${catMetaHit.color};color:${catMetaHit.color};display:inline-flex">${icon(catMetaHit.icon, 16)}</span>
      Browse all ${app.world.catCounts[catMatch] || 0} ${h(catMetaHit.plural)}</button>` : ''}
  </div>
  <div class="section">
    ${results.length ? `<div class="result-list">
      ${results.map((r) => r.kind === 'place'
        ? resultRow(r.item, { distance: r.distance, app })
        : searchRowSimple(r, app)).join('')}
    </div>` : `<div class="empty-state">
      <div class="empty-icon">${icon('search', 20)}</div>
      <h3>No match in the survey</h3>
      <p>Try a street name, a metro station, or a category like cafe or park.</p>
      <button class="btn sm" style="margin-top:12px" data-act="clear-search">Clear search</button>
    </div>`}
  </div>`;
}

function searchRowSimple(r, app) {
  const isRoad = r.kind === 'road';
  const isStation = r.kind === 'station';
  const meta = isRoad ? { icon: 'ruler', color: 'var(--c-text-muted)' } : { icon: 'train', color: '#7c3aed' };
  return `<button class="result" data-act="${isRoad ? 'fly-road' : 'open-station'}" data-key="${h(r.item.id)}">
    <span class="result-icon" style="--cat-color:${meta.color}">${icon(meta.icon, 17)}</span>
    <span class="result-main">
      <span class="result-name">${h(r.title)}</span>
      <span class="result-meta">${h(r.sub)}<span class="dot"></span>${isRoad ? 'Street' : 'Metro'}</span>
    </span>
    <span class="result-side">${isRoad ? icon('navigate', 13) : icon('chevronRight', 14)}</span>
  </button>`;
}

export function resultRow(p, { distance = null, app, note = null, group = null, saved = null } = {}) {
  const meta = catMeta(p.cat);
  const st = openState(p);
  const isSavedNow = saved === null ? isSaved(p.id) : saved;
  const quiet = quietScore(p);
  return `
  <button class="result" data-act="open-place" data-id="${p.id}" role="option" aria-selected="false">
    <span class="result-icon" style="--cat-color:${meta.color}">${icon(meta.icon, 17)}</span>
    <span class="result-main">
      <span class="result-name">${h(p.name)}</span>
      <span class="result-meta">
        <span>${h(p.kindLabel)}</span>
        ${addressOneLine(p) !== 'Bengaluru' ? `<span class="dot"></span><span>${h(shortAddress(p))}</span>` : ''}
        ${st.known ? `<span class="dot"></span><span class="${st.open ? 'text-open' : ''}">${h(st.text)}</span>` : ''}
        ${distance != null ? `<span class="dot"></span><span>${fmtD(distance)}</span>` : ''}
      </span>
      ${note || group ? `<span class="result-tags">
        ${group ? `<span class="badge" style="color:${group.color};background:color-mix(in srgb, ${group.color} 12%, var(--c-surface))">${h(group.name)}</span>` : ''}
        ${isSavedNow ? `<span class="badge">${icon('bookmark', 11)} Saved</span>` : ''}
        ${note ? `<span class="badge quiet">${icon('note', 11)} Note</span>` : ''}
      </span>` : ''}
    </span>
    <span class="result-side">${quiet >= 74 ? `<span class="badge quiet" title="Quiet score ${quiet}">calm</span>` : ''}${icon('chevronRight', 14)}</span>
  </button>`;
}

export function placeView(view, app, place) {
  const s = getState();
  const meta = catMeta(place.cat);
  const st = openState(place);
  const hours = hoursTable(place);
  const today = todayIndex();
  const note = getNote(place.id);
  const saved = isSaved(place.id);
  const entry = savedEntry(place.id);
  const lines = addressLines(place);
  const quiet = quietScore(place);
  const ql = quietLabel(quiet);
  const fixes = fixesFor(place.id);
  const open = fixes.filter((f) => f.status !== 'fixed');
  const cuisines = cuisineList(place);

  return `
  <div class="place-cover" style="--cat-color:${meta.color}">
    <span class="place-cover-tag">${h(meta.short)}</span>
    <span class="place-cover-icon">${icon(meta.icon, 26)}</span>
  </div>
  <div style="position:relative">
    <div class="place-head">
      <h2 class="place-name">${h(place.name)}</h2>
      <p class="place-kind">${h(kindLine(place))}</p>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        ${st.known ? `<span class="badge ${st.open ? 'open' : 'closed'}">${st.text}</span>` : `<span class="badge">Hours not listed</span>`}
        <span class="badge ${ql.tone}" title="Local estimate from the survey and reported fixes">${ql.label} \u00b7 ${quiet}</span>
        ${place.tags.wheelchair === 'yes' ? `<span class="badge">${icon('wheelchair', 11)} Step free</span>` : ''}
      </div>
    </div>
    <div class="action-row">
      <button class="action primary" data-act="directions-to" data-id="${place.id}">${icon('navigate', 18)}Directions</button>
      <button class="action" data-act="toggle-save" data-id="${place.id}" aria-pressed="${saved}">
        ${icon('bookmark', 18)}<span>${saved ? 'Saved' : 'Save'}</span></button>
      <button class="action" data-act="field-card" data-id="${place.id}">${icon('note', 18)}Card</button>
      <button class="action" data-act="share-place" data-id="${place.id}">${icon('share', 18)}Share</button>
    </div>
    <dl class="facts">
      <div class="fact">
        <span>${icon('pin', 16)}</span>
        <div><dt>Address</dt><dd>${lines.map(h).join('<br>')}</dd></div>
      </div>
      ${place.tags.phone || place.tags['contact:phone'] ? `<div class="fact">
        <span>${icon('phone', 16)}</span>
        <div><dt>Phone</dt><dd><a href="tel:${h((place.tags.phone || place.tags['contact:phone']).replace(/\s/g, ''))}">${h(place.tags.phone || place.tags['contact:phone'])}</a></dd></div>
      </div>` : ''}
      ${place.tags.website || place.tags['contact:website'] ? `<div class="fact">
        <span>${icon('globe', 16)}</span>
        <div><dt>Website</dt><dd><a href="${h(place.tags.website || place.tags['contact:website'])}" target="_blank" rel="noopener noreferrer nofollow">${h(shortUrl(place.tags.website || place.tags['contact:website']))}</a></dd></div>
      </div>` : ''}
      ${hours ? `<div class="fact">
        <span>${icon('clock', 16)}</span>
        <div><dt>Hours</dt><dd class="hours-table">${hours.map((d, i) => `<div class="hours-row ${i === today ? 'today' : ''}"><span class="day">${DAY_SHORT[i]}</span><span>${h(d.text)}</span></div>`).join('')}</dd></div>
      </div>` : place.tags.opening_hours ? `<div class="fact"><span>${icon('clock', 16)}</span>
        <div><dt>Hours</dt><dd>${h(place.tags.opening_hours)}</dd></div></div>` : ''}
      ${place.tags.wheelchair ? `<div class="fact">
        <span>${icon('wheelchair', 16)}</span>
        <div><dt>Access</dt><dd>${place.tags.wheelchair === 'yes' ? 'Step free entry' : place.tags.wheelchair === 'limited' ? 'Partial step free access' : 'Not step free'}</dd></div>
      </div>` : ''}
      ${place.tags.cuisine ? `<div class="fact">
        <span>${icon('food', 16)}</span>
        <div><dt>Cuisine</dt><dd>${h(cuisines.join(', '))}</dd></div>
      </div>` : ''}
      <div class="fact">
        <span>${icon('ruler', 16)}</span>
        <div><dt>Survey</dt><dd>${app.world.meta.source}<br><a href="${place.osmUrl}" target="_blank" rel="noopener noreferrer nofollow">View the OSM record</a></dd></div>
      </div>
    </dl>

    <div class="note-box">
      <div class="note-label"><span>Your note</span>
        <span id="note-status" style="text-transform:none;letter-spacing:0;font-weight:500">${note ? 'Saved ' + timeAgo(note.updated) : 'Private to this browser'}</span></div>
      <label class="visually-hidden" for="place-note">Note about ${h(place.name)}</label>
      <textarea id="place-note" data-id="${place.id}" placeholder="What did you find? The queue, the step at the door, a better entrance." maxlength="600">${h(note?.text || '')}</textarea>
      <div class="note-hint">
        <span id="note-count">${(note?.text || '').length}/600</span>
        <span style="display:flex;gap:8px;align-items:center">
          <button class="link-btn" data-act="note-clear" data-id="${place.id}" ${note ? '' : 'hidden'}>Clear</button>
          <span>Saved as you type</span>
        </span>
      </div>
    </div>

    <div class="section">
      <div class="section-head">
        <span class="eyebrow">Fixes reported here</span>
        <button class="link-btn" data-act="report-fix" data-id="${place.id}">Report a fix</button>
      </div>
      ${open.length ? `<div style="display:flex;flex-direction:column;gap:6px">
        ${open.slice(0, 4).map((f) => `<div class="leg" style="background:var(--c-marigold-soft);align-items:flex-start">
          ${icon(ISSUES[f.issue]?.icon || 'warning', 15)}
          <div><b>${h(ISSUES[f.issue]?.label || 'Issue')}</b>
            <div style="font-size:var(--text-xs);color:var(--c-text-muted);margin-top:1px">${h(f.note || f.detail || 'Reported nearby')}</div></div>
          ${f.status === 'acknowledged' ? '<span class="badge" style="margin-left:auto">acknowledged</span>' : ''}
        </div>`).join('')}
      </div>` : `<p class="lede">No open reports on this place right now. ${guideNote(place)}.</p>`}
    </div>

    <div class="section">
      <div class="section-head"><span class="eyebrow">Nearby</span>
        <button class="link-btn" data-act="nearby" data-id="${place.id}">On the map</button></div>
      <div class="result-list">
        ${app.world.nearby(place.lon, place.lat, { limit: 4, radius: 450 }).filter((r) => r.p.id !== place.id).map(({ p, d }) => resultRow(p, { distance: d, app })).join('') || '<p class="lede">Nothing else surveyed within 450 m.</p>'}
      </div>
    </div>

    <div class="section">
      <div class="section-head"><span class="eyebrow">Keep it</span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="saved-group" class="btn" style="height:34px" aria-label="List for this place" data-id="${place.id}">
          ${s.groups.map((g) => `<option value="${g.id}" ${entry && entry.group === g.id ? 'selected' : ''}>${h(g.name)}</option>`).join('')}
        </select>
        <button class="btn sm" data-act="home-here" data-id="${place.id}">${icon('home', 14)} Set as home</button>
        <button class="btn sm" data-act="work-here" data-id="${place.id}">${icon('work', 14)} Set as work</button>
      </div>
    </div>
  </div>`;
}

function shortAddress(p) {
  const t = p.tags || {};
  return [t.road || t.quarter || t.suburb].filter(Boolean)[0] || addressOneLine(p);
}

function shortUrl(u) {
  try {
    const url = new URL(u);
    return url.hostname.replace(/^www\./, '') + (url.pathname !== '/' ? url.pathname : '');
  } catch {
    return u;
  }
}

function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' min ago';
  const hr = Math.round(m / 60);
  if (hr < 24) return hr + ' h ago';
  return Math.round(hr / 24) + ' d ago';
}

// ---------------- directions ----------------

export function directionsView(view, app) {
  const s = getState();
  const mode = s.routePrefs.mode;
  const hour = s.routePrefs.hour;
  const origin = view.dir.origin;
  const dest = view.dir.destination;
  const opts = view.route?.options || [];
  const sel = view.route?.selected ?? 0;
  const route = opts[sel];
  const modes = [
    ['walk', 'walk', 'Walk'],
    ['bike', 'bike', 'Cycle'],
    ['drive', 'car', 'Drive'],
    ['transit', 'train', 'Metro'],
  ];
  return `
  <div class="dir-form">
    <div class="dir-row">
      <span class="dir-dot"><span class="dot"></span></span>
      <label class="dir-field" style="flex:1">
        <span class="visually-hidden">Starting point</span>
        <input id="dir-from" type="text" placeholder="Choose a starting point" value="${h(origin?.name || '')}" autocomplete="off" spellcheck="false">
      </label>
      <div class="dir-actions">
        <button class="icon-btn" data-act="pick-start" aria-label="Use the map centre as the start" title="Use map centre">${icon('crosshair', 16)}</button>
      </div>
    </div>
    <div class="dir-row">
      <span class="dir-dot"><span class="square"></span></span>
      <label class="dir-field" style="flex:1">
        <span class="visually-hidden">Destination</span>
        <input id="dir-to" type="text" placeholder="Where to?" value="${h(dest?.name || '')}" autocomplete="off" spellcheck="false">
      </label>
      <div class="dir-actions">
        <button class="icon-btn" data-act="swap" aria-label="Swap start and destination" title="Swap">${icon('swap', 16)}</button>
      </div>
    </div>
    ${!origin ? `<div class="chips" style="padding:8px 0 0">
      <span class="eyebrow" style="align-self:center;margin-right:2px">Start from</span>
      <button class="chip" data-act="origin-locate">${icon('locate', 12)} My location</button>
      <button class="chip" data-act="origin-centre">${icon('crosshair', 12)} Map centre</button>
      ${s.settings.home ? `<button class="chip" data-act="quick-home">${icon('home', 12)} Home</button>` : ''}
      ${s.settings.work ? `<button class="chip" data-act="quick-work">${icon('work', 12)} Work</button>` : ''}
    </div>` : ''}
  </div>

  <div class="section">
    <div class="seg" role="group" aria-label="Travel mode">
      ${modes.map(([m, ic, label]) => `<button data-act="mode" data-mode="${m}" aria-pressed="${mode === m}">
        ${icon(ic, 16)}<span>${label}</span></button>`).join('')}
    </div>
  </div>

  ${mode !== 'walk' ? `
  <div class="section">
    <div class="section-head" style="margin-bottom:6px">
      <span class="eyebrow">Leaving at</span>
      <span class="badge">${h(hourLabel(hour))}</span>
    </div>
    <div class="depart-row">
      <span style="font-size:var(--text-xs);color:var(--c-text-faint)">6 am</span>
      <input id="hour-range" type="range" min="6" max="22" step="0.5" value="${hour}" aria-label="Time of day for traffic estimate" style="--pct:${((hour - 6) / 16) * 100}%">
      <span style="font-size:var(--text-xs);color:var(--c-text-faint)">10 pm</span>
    </div>
    <p class="lede" style="margin-top:6px">Times use a typical weekday pattern, not live traffic. Bigger roads cost more at peak.</p>
  </div>` : `<div class="section"><p class="lede">Walking times do not change with traffic. Switch to Drive to see how the peak hour changes the route.</p></div>`}

  ${!origin || !dest ? `<div class="section">
    <div class="empty-state">
      <div class="empty-icon">${icon('navigate', 20)}</div>
      <h3>Pick two points</h3>
      <p>Search, use Home and Work, or right click the map to set a start or a destination.</p>
    </div>
  </div>` : ''}

  ${sameSpot(origin, dest) ? `<div class="section"><div class="empty-state">
      <div class="empty-icon">${icon('crosshair', 20)}</div><h3>Same spot</h3>
      <p>The start and the destination are the same place. Pick a different destination.</p>
      <button class="btn sm" style="margin-top:10px" data-act="swap">${icon('swap', 14)} Swap them</button>
    </div></div>` : ''}
  ${route && !sameSpot(origin, dest) ? renderRouteOptions(opts, sel, app) : (origin && dest && !sameSpot(origin, dest) ? `<div class="section"><div class="empty-state"><div class="empty-icon">${icon('warning', 20)}</div><h3>No ${mode} route inside the survey</h3><p>This survey covers central Bengaluru. Try another mode or a point closer in.</p></div></div>` : '')}

  ${route && !sameSpot(origin, dest) ? renderRouteDetail(route, app, mode) : ''}

  <div class="section">
    <div class="section-head"><span class="eyebrow">Journey tools</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn" style="justify-content:flex-start" data-act="toggle-layer" data-layer="quiet" aria-pressed="${view.layers.quiet}">
        ${icon('waves', 16)} Quiet streets layer ${view.layers.quiet ? '<span class="badge quiet" style="margin-left:auto">on</span>' : ''}
      </button>
      <button class="btn" style="justify-content:flex-start" data-act="toggle-layer" data-layer="busy" aria-pressed="${view.layers.busy}">
        ${icon('therm', 16)} Busy by time of day ${view.layers.busy ? '<span class="badge" style="margin-left:auto">on</span>' : ''}
      </button>
      <button class="btn" style="justify-content:flex-start" data-act="toggle-layer" data-layer="accessibility" aria-pressed="${view.layers.accessibility}">
        ${icon('wheelchair', 16)} Step free only ${view.layers.accessibility ? '<span class="badge quiet" style="margin-left:auto">on</span>' : ''}
      </button>
      <div style="display:flex;gap:8px">
        <button class="btn" style="flex:1" data-act="add-stop">${icon('plusCircle', 15)} Add a stop</button>
        <button class="btn" style="flex:1" data-act="print-route">${icon('printer', 15)} Print</button>
      </div>
    </div>
  </div>`;
}

function sameSpot(a, b) {
  if (!a || !b) return false;
  return haversine(a.lon, a.lat, b.lon, b.lat) < 20;
}

export function hourLabel(h) {
  return formatClock(Math.round(h * 60)).replace(':00', '') + ' weekday';
}

function renderRouteOptions(opts, sel, app) {
  return `<div class="section">
    <div class="section-head"><span class="eyebrow">${opts.length} route${opts.length > 1 ? 's' : ''}</span>
      <span class="lede">${app.world.meta.area}</span></div>
    <div class="route-options">
      ${opts.map((r, i) => {
        const name = r.kind === 'quiet' ? 'Quietest' : r.kind === 'stepfree' ? 'Step free' : r.kind === 'transfer' ? 'One change' : r.mode === 'transit' ? 'Metro' : 'Fastest';
        const badges = [];
        if (r.mode === 'transit') {
          badges.push(`${r.stops} stop${r.stops === 1 ? '' : 's'}`);
          if (r.transfers) badges.push(`${r.transfers} change`);
          badges.push(formatMoney(r.fare));
          if (r.walk && r.seconds > r.walk.seconds * 1.6) badges.push('slower than walking');
        } else {
          if (r.kind === 'quiet') badges.push(`noise ${Math.round(r.noise)}`);
          if (r.kind === 'stepfree') badges.push('no steps');
          if (r.mode === 'drive') badges.push(formatMoney(estimateFuel(r)) + ' fuel');
          if (r.mode === 'bike') badges.push(formatMoney(estimateBike(r)) + ' rental');
        }
        return `<button class="route-card" data-act="pick-route" data-ix="${i}" aria-pressed="${i === sel}">
          <span class="bar"></span>
          <span class="route-card-main">
            <span class="route-title">${r.mode === 'transit' ? icon('train', 14) : r.mode === 'bike' ? icon('bike', 14) : r.mode === 'drive' ? icon('car', 14) : icon('walk', 14)} ${name}</span>
            <span class="route-sub">${r.mode === 'transit' && r.stations ? `${h(r.stations.from)} to ${h(r.stations.to)}` : `${fmtD(r.metres)} \u00b7 ${r.kind === 'quiet' ? 'calmer streets' : r.kind === 'stepfree' ? 'avoids steps' : 'main roads'}`}</span>
            <span class="route-badges">${badges.map((b) => `<span class="badge">${h(b)}</span>`).join('')}</span>
          </span>
          <span class="route-time"><b>${fmtT(r.seconds)}</b><span>${r.kind === 'quiet' ? 'quieter' : r.kind === 'stepfree' ? 'no steps' : 'fastest'}</span></span>
        </button>`;
      }).join('')}
    </div>
  </div>`;
}

function renderNoiseCompare(route) {
  const noise = Math.round(route.noise || 0);
  const pct = Math.max(4, Math.min(100, noise));
  const tone = noise < 34 ? 'quiet' : noise < 58 ? '' : 'warn';
  const verdict = noise < 34 ? 'Calm enough to talk on' : noise < 58 ? 'Some traffic noise' : 'Loud, main road traffic';
  return `<div class="section">
    <div class="section-head"><span class="eyebrow">Noise on this route</span>
      <span class="badge ${tone}">${noise}/100</span></div>
    <div class="noise-bar" role="img" aria-label="Average street noise ${noise} out of 100">
      <span style="width:${pct}%"></span>
    </div>
    <p class="lede" style="margin-top:6px">Average across the street segments on this route. The Quietest option trades time for calmer streets.</p>
    <p class="lede" style="margin-top:4px;color:var(--c-text)">${verdict}.</p>
  </div>`;
}

function estimateFuel(r) {
  const km = r.metres / 1000;
  return Math.round(km * 6.4);
}
function estimateBike(r) {
  return Math.max(10, Math.round((r.metres / 1000) * 4));
}

function renderRouteDetail(route, app, mode) {
  const steps = route.steps || [];
  return `
  ${route.mode === 'transit' ? `<div class="section">
    <div class="fare-grid">
      <div class="fare"><div class="fare-label">Fare</div><div class="fare-value">${formatMoney(route.fare)}</div><div class="fare-sub">metro, cashless</div></div>
      <div class="fare"><div class="fare-label">Stops</div><div class="fare-value">${route.stops}</div><div class="fare-sub">${route.transfers ? route.transfers + ' change' : 'direct'}</div></div>
      <div class="fare"><div class="fare-label">Ride</div><div class="fare-value">${fmtT(route.legs[1].seconds)}</div><div class="fare-sub">plus walking</div></div>
    </div>
    <div style="margin-top:10px">
      ${route.legs.map((leg) => leg.type === 'walk'
        ? `<div class="leg">${icon('walk', 15)}<span>Walk ${fmtD(leg.metres)} <b>${fmtT(leg.seconds)}</b>${leg.to ? ' to ' + h(leg.to) : ''}</span></div>`
        : leg.rides.map((r) => `<div class="leg">${icon('train', 15)}<span class="line-pill" style="background:${r.line.id === 'purple' ? '#7c3aed' : '#15803d'}">${h(r.line.name.replace(' Line', ''))}</span><span>${h(r.from)} to <b>${h(r.to)}</b> \u00b7 ${r.stops} stops</span></div>`).join('')).join('')}
    </div>
  </div>` : ''}
  ${route.mode !== 'transit' ? renderNoiseCompare(route) : ''}
  <div class="section">
    <div class="section-head"><span class="eyebrow">Step by step</span>
      <span class="lede">${steps.length} steps</span></div>
    <div class="steps">
      ${steps.map((st) => `<div class="step ${st.turn === 'arrive' ? 'highlight' : ''}">
        <span class="step-icon">${icon(st.icon, 15)}</span>
        <span class="step-text">${h(st.instruction)}${st.stops ? ` <span class="badge">${st.stops} stops</span>` : ''}</span>
        <span class="step-dist">${st.metres ? fmtD(st.metres) : ''}</span>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn sm" data-act="copy-route">${icon('copy', 13)} Copy directions</button>
      <button class="btn sm" data-act="share-route">${icon('share', 13)} Share</button>
    </div>
  </div>`;
}

// ---------------- saved ----------------

export function savedView(view, app) {
  const s = getState();
  const totals = { places: s.saved.length, notes: noteCount(), fixes: fixCount() };
  return `
  <div class="section">
    <div class="section-head"><span class="eyebrow">Your map</span></div>
    <h2 class="section-title">Saved and noted</h2>
    <p class="lede" style="margin-top:6px">Everything on this page lives in this browser. Export it any time from Settings.</p>
    <div class="fare-grid" style="margin-top:14px">
      <div class="fare"><div class="fare-label">Saved</div><div class="fare-value">${totals.places}</div><div class="fare-sub">places</div></div>
      <div class="fare"><div class="fare-label">Notes</div><div class="fare-value">${totals.notes}</div><div class="fare-sub">written</div></div>
      <div class="fare"><div class="fare-label">Fixes</div><div class="fare-value">${totals.fixes}</div><div class="fare-sub">open</div></div>
    </div>
  </div>
  ${Object.keys(s.notes).length ? `<div class="section">
    <div class="section-head"><span class="eyebrow">Notes you wrote</span>
      <span class="badge">${Object.keys(s.notes).length}</span></div>
    ${Object.entries(s.notes).slice(0, 12).map(([id, n]) => {
      const p = app.world.placesById.get(id);
      if (!p) return '';
      return `<div class="saved-item">
        <button class="result-icon" data-act="open-place" data-id="${p.id}" style="--cat-color:${catMeta(p.cat).color}" aria-label="Open ${h(p.name)}">${icon('note', 16)}</button>
        <div style="min-width:0">
          <button class="result-name" data-act="open-place" data-id="${p.id}" style="border:0;background:none;padding:0;text-align:left;width:100%">${h(p.name)}</button>
          <div class="saved-note">${h(n.text)}</div>
        </div>
        <span class="result-side">${icon('chevronRight', 14)}</span>
      </div>`;
    }).join('')}
  </div>` : ''}
  ${s.groups.map((g) => {
    const items = s.saved.filter((x) => x.group === g.id).map((x) => ({ x, p: app.world.placesById.get(x.placeId) })).filter((o) => o.p);
    return `<div class="section list-group">
      <div class="list-group-head">
        <div class="list-group-name"><span class="swatch" style="background:${g.color}"></span>${h(g.name)}
          <span class="badge">${items.length}</span></div>
        ${items.length ? `<button class="link-btn" data-act="open-list" data-group="${g.id}">Show on map</button>` : ''}
      </div>
      ${items.length ? items.map(({ x, p }) => {
        const note = getNote(p.id);
        return `<div class="saved-item">
          <button class="result-icon" data-act="open-place" data-id="${p.id}" style="--cat-color:${catMeta(p.cat).color}" aria-label="Open ${h(p.name)}">${icon(catMeta(p.cat).icon, 16)}</button>
          <div style="min-width:0">
            <button class="result-name" data-act="open-place" data-id="${p.id}" style="border:0;background:none;padding:0;text-align:left;width:100%">${h(p.name)}</button>
            <div class="result-meta">${h(p.kindLabel)}<span class="dot"></span>${fmtD(haversine(app.cam.lon, app.cam.lat, p.lon, p.lat))} away</div>
            ${note ? `<div class="saved-note">${h(note.text)}</div>` : ''}
          </div>
          <button class="icon-btn" data-act="remove-saved" data-id="${p.id}" aria-label="Remove ${h(p.name)} from saved">${icon('trash', 15)}</button>
        </div>`;
      }).join('') : `<p class="lede" style="padding:4px 0 10px">Nothing in this list yet. Save a place from its page.</p>`}
    </div>`;
  }).join('')}
  <div class="section">
    <div style="display:flex;gap:8px">
      <button class="btn" data-act="new-list">${icon('plus', 15)} New list</button>
      <button class="btn" data-act="export">${icon('download', 15)} Export</button>
    </div>
    ${s.groups.length > 2 ? `<div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
      ${s.groups.slice(2).map((g) => `<button class="chip" data-act="del-list" data-group="${g.id}">${h(g.name)} ${icon('close', 11)}</button>`).join('')}
    </div>` : ''}
  </div>`;
}

// ---------------- fixes ----------------

export function fixesView(view, app) {
  const s = getState();
  const mine = s.fixes;
  const center = [app.cam.lon, app.cam.lat];
  const busiest = app.world.places
    .filter((p) => p.cat === 'food' || p.cat === 'culture' || p.cat === 'shop')
    .map((p) => ({ p, score: quietScore(p), d: haversine(center[0], center[1], p.lon, p.lat) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
  return `
  <div class="section">
    <div class="section-head"><span class="eyebrow">New in Chowk</span></div>
    <h2 class="section-title">The fixes layer</h2>
    <p class="lede" style="margin-top:6px">A map tells you where a place is. This layer tells you what the walk there is actually like: broken pavements, crossings without signals, entrances without ramps. Add a report in ten seconds. It stays on the map until it is marked fixed.</p>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn primary" data-act="report-fix" data-id="">${icon('plus', 15)} Report a fix</button>
      <button class="btn" data-act="toggle-layer" data-layer="quiet" aria-pressed="${view.layers.quiet}">${icon('waves', 15)} Quiet streets</button>
    </div>
  </div>
  <div class="section">
    <div class="section-head"><span class="eyebrow">Your reports</span>
      <span class="badge">${mine.length}</span></div>
    ${mine.length ? `<div style="display:flex;flex-direction:column;gap:8px">
      ${mine.slice(0, 12).map((f) => `<div class="route-card" style="grid-template-columns:4px 1fr;cursor:default">
        <span class="bar" style="background:${f.status === 'fixed' ? 'var(--c-accent)' : 'var(--c-marigold)'}"></span>
        <div class="route-card-main" style="padding:10px 12px 10px 0">
          <div class="route-title">${icon(ISSUES[f.issue]?.icon || 'warning', 14)} ${h(ISSUES[f.issue]?.label || 'Issue')}</div>
          <div class="route-sub">${h(f.name || 'Near the map centre')} \u00b7 ${timeAgo(f.at)}</div>
          ${f.detail ? `<div class="route-sub" style="color:var(--c-text)">${h(f.detail)}</div>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px">
            <button class="btn sm" data-act="fix-status" data-id="${f.id}" data-status="${f.status === 'fixed' ? 'reported' : 'fixed'}">
              ${icon(f.status === 'fixed' ? 'arrowLeft' : 'check', 12)} ${f.status === 'fixed' ? 'Reopen' : 'Mark fixed'}</button>
            <button class="btn sm ghost" data-act="fix-goto" data-id="${f.id}">${icon('navigate', 12)} Show</button>
          </div>
        </div>
      </div>`).join('')}
    </div>` : `<div class="empty-state">
      <div class="empty-icon">${icon('warning', 20)}</div>
      <h3>No reports yet</h3>
      <p>Right click the map, or use the button above, to drop the first one.</p>
    </div>`}
  </div>
  <div class="section">
    <div class="section-head"><span class="eyebrow">Hardest walks near the centre</span></div>
    <div class="result-list">
      ${busiest.map(({ p, score, d }) => {
        const ql = quietLabel(score);
        return `<button class="result" data-act="open-place" data-id="${p.id}">
          <span class="result-icon" style="--cat-color:${catMeta(p.cat).color}">${icon(catMeta(p.cat).icon, 16)}</span>
          <span class="result-main"><span class="result-name">${h(p.name)}</span>
            <span class="result-meta">${h(p.kindLabel)}<span class="dot"></span>${fmtD(d)}</span></span>
          <span class="result-side"><span class="badge ${ql.tone}">${score}</span></span>
        </button>`;
      }).join('')}
    </div>
  </div>
  <div class="section">
    <div class="section-head"><span class="eyebrow">Accessibility outreach</span>
      <button class="link-btn" data-act="add-contact">Add a place</button></div>
    <p class="lede" style="margin-bottom:8px">When a place is not step free, ask before you go. Keep the answer here.</p>
    ${s.contact.length ? s.contact.map((c) => `<div class="saved-item">
      <span class="result-icon" style="--cat-color:var(--c-text-muted)">${icon('wheelchair', 16)}</span>
      <div style="min-width:0"><div class="result-name">${h(c.name)}</div>
        <div class="result-meta">${h(c.address || 'Bengaluru')}<span class="dot"></span>${c.status === 'yes' ? 'Step free confirmed' : c.status === 'no' ? 'Not step free' : 'Waiting to hear back'}</div>
        ${c.note ? `<div class="saved-note">${h(c.note)}</div>` : ''}</div>
      <button class="icon-btn" data-act="del-contact" data-id="${c.id}" aria-label="Remove ${h(c.name)}">${icon('trash', 15)}</button>
    </div>`).join('') : `<p class="lede">Nothing on the list. Look for the step free badge when you open a place.</p>`}
  </div>`;
}

// ---------------- settings ----------------

export function settingsView(view, app) {
  const s = getState();
  return `
  <div class="section">
    <div class="section-head"><span class="eyebrow">Look and feel</span></div>
    <div class="theme-row" role="group" aria-label="Theme">
      ${[['auto', 'Auto', 'linear-gradient(135deg,#fffcf4 50%,#1c1a16 50%)', '#0b6e4f'],
        ['light', 'Day', 'linear-gradient(135deg,#f3eada,#fffcf4)', '#0b6e4f'],
        ['dark', 'Night', 'linear-gradient(135deg,#131210,#2c2823)', '#4fc79b'],
        ['contrast', 'Contrast', 'linear-gradient(135deg,#ffffff,#000000)', '#00432f']].map(([id, label, bg, dot]) => `
        <button class="theme-card" data-act="set-theme" data-theme="${id}" aria-pressed="${s.settings.theme === id}">
          <span class="theme-swatch" style="background:${bg}"><i style="background:${dot}"></i></span>
          <span class="theme-name">${label}</span>
        </button>`).join('')}
    </div>
    <div class="toggle-row" style="margin-top:8px">
      <div><div class="toggle-label">Pixel map</div><div class="toggle-desc">Low resolution, high clarity</div></div>
      <button class="switch" role="switch" data-act="toggle-setting" data-key="pixel" aria-checked="${s.settings.pixel}" aria-label="Pixel map"></button>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">Units</div><div class="toggle-desc">Metric or imperial</div></div>
      <div class="seg" style="width:150px">
        <button data-act="units" data-units="metric" aria-pressed="${s.settings.units === 'metric'}">km</button>
        <button data-act="units" data-units="imperial" aria-pressed="${s.settings.units === 'imperial'}">mi</button>
      </div>
    </div>
  </div>
  <div class="section">
    <div class="section-head"><span class="eyebrow">Routing defaults</span></div>
    <div class="toggle-row">
      <div><div class="toggle-label">Prefer quieter streets</div><div class="toggle-desc">Weight by measured street noise</div></div>
      <button class="switch" role="switch" data-act="toggle-setting" data-key="quietWeight" aria-checked="${s.settings.quietWeight}" aria-label="Prefer quieter streets"></button>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">Step free only</div><div class="toggle-desc">Avoid steps and stairways</div></div>
      <button class="switch" role="switch" data-act="toggle-setting" data-key="accessibility" aria-checked="${s.settings.accessibility}" aria-label="Step free only"></button>
    </div>
    <div class="toggle-row">
      <div><div class="toggle-label">Traffic curve</div><div class="toggle-desc">Peak hour weighting for driving and cycling</div></div>
      <button class="switch" role="switch" data-act="toggle-setting" data-key="traffic" aria-checked="${s.settings.traffic}" aria-label="Traffic curve"></button>
    </div>
  </div>
  <div class="section">
    <div class="section-head"><span class="eyebrow">Your data</span></div>
    <p class="lede">Saved places, notes and fixes stay in this browser. Nothing is sent anywhere.</p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn" data-act="export">${icon('download', 15)} Export JSON</button>
      <button class="btn" data-act="print-route">${icon('printer', 15)} Print poster</button>
      <button class="btn danger" data-act="reset-data">${icon('trash', 15)} Reset everything</button>
    </div>
  </div>
  <div class="section">
    <div class="section-head"><span class="eyebrow">The survey</span></div>
    <p class="lede">${app.world.meta.counts.places} places, ${app.world.meta.counts.roads} street segments, ${app.world.meta.counts.buildings} buildings and ${app.world.meta.counts.metro} metro stations, all inside ${h(app.world.meta.area)}. Data from OpenStreetMap contributors under ODbL 1.0. The map is drawn from that data, not from map tiles.</p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn sm" data-act="tour">${icon('sparkle', 14)} What is new</button>
      <button class="btn sm" data-act="shortcuts">${icon('keyboard', 14)} Shortcuts</button>
      <button class="btn sm" data-act="list-view">${icon('list', 14)} List view</button>
    </div>
  </div>
  <div class="section">
    <p class="lede" style="font-size:var(--text-xs)">Chowk is a clean room survey of central Bengaluru: same jobs, new words, new look, open data. Independent, and not affiliated with any map provider.</p>
  </div>`;
}

export { masthead as _masthead };
