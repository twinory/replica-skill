// Geodesy and small formatting helpers.

export const R_EARTH = 6371008.8;
export const rad = (d) => (d * Math.PI) / 180;
export const deg = (r) => (r * 180) / Math.PI;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function haversine(lon1, lat1, lon2, lat2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dp = p2 - p1;
  const dl = rad(lon2 - lon1);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(lon1, lat1, lon2, lat2) {
  const p1 = rad(lat1);
  const p2 = rad(lat2);
  const dl = rad(lon2 - lon1);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Distance in metres from a point to a segment, in a local flat projection. */
export function pointSegmentM(px, py, ax, ay, bx, by) {
  const kx = Math.cos(rad(py)) * 111320;
  const ky = 110540;
  const x = px * kx, y = py * ky;
  const x1 = ax * kx, y1 = ay * ky, x2 = bx * kx, y2 = by * ky;
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((x - x1) * dx + (y - y1) * dy) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(x - cx, y - cy);
}

export function turnType(a, b) {
  let d = ((b - a + 540) % 360) - 180;
  if (Math.abs(d) < 18) return { key: 'straight', d };
  if (Math.abs(d) > 152) return { key: 'uturn', d };
  if (d > 0) return { key: d > 50 ? 'right' : 'slight-right', d };
  return { key: d < -50 ? 'left' : 'slight-left', d };
}

export function compass(b) {
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round(((b % 360) / 45)) % 8];
}

export function formatDistance(m, units = 'metric') {
  if (units === 'imperial') {
    const ft = m * 3.28084;
    if (ft < 1000) return Math.round(ft / 10) * 10 + ' ft';
    return (m / 1609.344).toFixed(m < 16093 ? 1 : 0) + ' mi';
  }
  if (m < 950) return Math.round(m / 10) * 10 + ' m';
  if (m < 9500) return (m / 1000).toFixed(2).replace(/0$/, '') + ' km';
  return Math.round(m / 1000) + ' km';
}

export function formatDuration(sec) {
  const m = Math.max(1, Math.round(sec / 60));
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h + ' h' + (r ? ' ' + r + ' min' : '');
}

export function formatClock(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(Math.round(m % 60)).padStart(2, '0');
  const ampm = h24 >= 12 ? 'pm' : 'am';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return h12 + ':' + mm + ' ' + ampm;
}

export function formatMoney(v, currency = 'INR') {
  const n = Math.round(v);
  return currency === 'INR' ? '\u20b9' + n.toLocaleString('en-IN') : '$' + n;
}

export function bboxOf(points) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of points) {
    if (x < a) a = x;
    if (y < b) b = y;
    if (x > c) c = x;
    if (y > d) d = y;
  }
  return [a, b, c, d];
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

export function centroid(points) {
  let x = 0, y = 0;
  for (const p of points) { x += p[0]; y += p[1]; }
  return [x / points.length, y / points.length];
}

export function pathLength(pts) {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += haversine(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
  return d;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = n + (n << 3);
  n = n ^ (n >>> 4);
  n = Math.imul(n, 0x27d4eb2d);
  n = n ^ (n >>> 15);
  return (n >>> 0) / 4294967295;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
