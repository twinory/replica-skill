// Opening hours, address lines and other facts about a place.

import { subLabel } from './data.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_IX = { Su: 0, Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6 };
const ORDER = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function parseDayToken(tok) {
  if (!tok) return [];
  const parts = tok.split('-');
  const a = DAY_IX[parts[0].slice(0, 2)];
  const b = parts[1] ? DAY_IX[parts[1].slice(0, 2)] : a;
  if (a === undefined || b === undefined) return [];
  const out = [];
  let d = a;
  for (let guard = 0; guard < 8; guard++) {
    out.push(d);
    if (d === b) break;
    d = (d + 1) % 7;
  }
  return out;
}

function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/** Very small opening_hours parser: enough for the tags in this dataset. */
export function parseHours(tag) {
  if (!tag) return null;
  const text = String(tag).trim();
  if (/^24\/7$/.test(text)) {
    const week = DAYS.map((d, i) => ({ day: DAY_NAMES[i], short: DAYS[i], text: 'Open 24 hours', open: true }));
    return { week, is24: true, raw: text };
  }
  const week = DAYS.map((d, i) => ({ day: DAY_NAMES[i], short: DAYS[i], text: 'Closed', open: false, ranges: [] }));
  const rules = text.split(';').map((r) => r.trim()).filter(Boolean);
  let any = false;
  for (const rule of rules) {
    // "Mo-Fr 09:00-18:00" or "Sa,Su 10:00-14:00" or "Mo-Su,PH off"
    const m = /^([A-Za-z,\-\s]+?)\s+(.*)$/.exec(rule);
    if (!m) continue;
    const days = m[1].split(',').flatMap((d) => parseDayToken(d.trim())).filter((d) => d !== undefined);
    const rest = m[2].trim();
    if (!days.length) continue;
    if (/^off$/i.test(rest)) {
      for (const d of days) week[d].text = 'Closed';
      any = true;
      continue;
    }
    const ranges = rest.split(',').map((r) => {
      const t = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(r.trim());
      if (!t) return null;
      return [parseTime(t[1]), parseTime(t[2])];
    }).filter(Boolean);
    if (!ranges.length) continue;
    for (const d of days) {
      week[d].ranges = ranges;
      week[d].text = ranges.map(([a, b]) => `${fmt(a)} to ${fmt(b)}`).join(', ');
      week[d].open = true;
      any = true;
    }
  }
  if (!any) return { week: null, raw: text, unknown: true };
  return { week, raw: text };
}

function fmt(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ampm;
}

/** Open now, plus a human sentence. Unknown hours never guess. */
export function openState(place, now = new Date()) {
  const tag = place?.tags?.opening_hours;
  const parsed = parseHours(tag);
  if (!parsed) return { known: false, open: null, text: 'Hours not listed', today: null, parsed: null };
  if (parsed.is24) return { known: true, open: true, text: 'Open 24 hours', today: 'Open 24 hours', parsed };
  if (parsed.unknown || !parsed.week) return { known: false, open: null, text: 'Hours not listed', today: null, parsed };
  const day = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const today = parsed.week[day];
  if (!today.ranges || !today.ranges.length) {
    return { known: true, open: false, text: 'Closed today', today: 'Closed', parsed, day, mins };
  }
  let open = false;
  for (const [a, b] of today.ranges) {
    if (b > a) { if (mins >= a && mins < b) open = true; }
    else if (mins >= a || mins < b) open = true; // past midnight
  }
  let text;
  if (open) {
    const close = today.ranges.find(([a, b]) => mins >= a && mins < b);
    text = close ? 'Open until ' + fmt(close[1]) : 'Open now';
  } else {
    const next = today.ranges.find(([a]) => a > mins);
    text = next ? 'Closes at ' + fmt(today.ranges[0][1]) + ', opens ' + fmt(next[0]) : 'Closed now';
  }
  return { known: true, open, text, today: today.text, parsed, day, mins };
}

export function addressLines(place) {
  const t = place.tags || {};
  const out = [];
  const street = t.street;
  const num = t.housenumber;
  if (street || num) out.push([num, street].filter(Boolean).join(' '));
  const area = t.suburb || t.quarter || t.locality;
  if (area) out.push(area);
  if (t.postcode) out.push(t.postcode);
  out.push('Bengaluru');
  return out.filter(Boolean);
}

export function addressOneLine(place) {
  return addressLines(place).join(', ');
}

export function kindLine(place) {
  const t = place.tags || {};
  const base = subLabel(place.sub);
  const bits = [base];
  if (t.cuisine) {
    const cuisines = t.cuisine.split(';').map((c) => c.replace(/_/g, ' ')).filter(Boolean);
    bits.unshift(cuisines.map(cap).join(', ') + ' ' + (cuisines.length > 1 ? 'food' : (place.sub === 'cafe' ? 'coffee' : 'food')));
  }
  if (t.wheelchair === 'yes' && place.cat !== 'transit') bits.push('step free');
  return bits.join(' \u00b7 ');
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function cuisineList(place) {
  const c = place?.tags?.cuisine;
  if (!c) return [];
  return c.split(';').map((x) => cap(x.replace(/_/g, ' '))).filter(Boolean);
}

export const DAY_SHORT = DAYS;

export function hoursTable(place) {
  const st = openState(place);
  if (!st.parsed || !st.parsed.week) return null;
  return st.parsed.week;
}

export function todayIndex() {
  return new Date().getDay();
}

export function priceLevel(place) {
  return null; // no invented price data
}
