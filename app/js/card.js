// Field card: a printable, shareable poster for one place.
// Drawn with canvas so it downloads as a PNG and prints cleanly.

import { iconData, catMeta } from './icons.js';
import { addressLines, openState, kindLine } from './place.js';
import { quietScore, quietLabel, guideNote } from './fixes.js';
import { formatDistance } from './geo.js';

const CARD_W = 760;
const CARD_H = 760;

const ACCENTS = [
  { id: 'forest', label: 'Forest', bg: '#fffcf4', ink: '#1b1815', accent: '#0b6e4f', soft: '#dcebe0' },
  { id: 'marigold', label: 'Marigold', bg: '#fff8ee', ink: '#231a12', accent: '#b4490f', soft: '#f7e3d2' },
  { id: 'ink', label: 'Ink', bg: '#14120f', ink: '#f6efe2', accent: '#8fd6b4', soft: '#24332c' },
  { id: 'rose', label: 'Rose', bg: '#fff7f6', ink: '#251717', accent: '#a33a52', soft: '#f6dfe3' },
];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx, text, max, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let cut = false;
  let i = 0;
  for (; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(next).width > max && line) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines) { cut = true; break; }
    } else line = next;
  }
  if (!cut && line) lines.push(line);
  else if (cut && line && lines.length === maxLines) {
    lines[maxLines - 1] = lines[maxLines - 1] + ' ' + line;
  }
  if (cut) {
    let last = lines[maxLines - 1];
    while (last.length > 4 && ctx.measureText(last + '...').width > max) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trimEnd() + '...';
  }
  return lines;
}

/** Draw the local street pattern around a place as a quiet background. */
function drawMiniMap(ctx, world, center, x, y, w, h, accent, ink, surface) {
  ctx.save();
  rr(ctx, x, y, w, h, 18);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.clip();
  const span = 0.0055; // degrees across
  const sx = (lon) => x + ((lon - (center[0] - span)) / (span * 2)) * w;
  const sy = (lat) => y + ((center[1] + span) - lat) / (span * 2) * h;
  ctx.globalAlpha = 0.9;
  for (const a of world.parks) {
    ctx.beginPath();
    const p = a.ll;
    ctx.moveTo(sx(p[0][0]), sy(p[0][1]));
    for (let i = 1; i < p.length; i++) ctx.lineTo(sx(p[i][0]), sy(p[i][1]));
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.14;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const cls of [4, 3, 2, 1, 0]) {
    ctx.beginPath();
    for (const r of world.roads) {
      if (r.cls !== cls) continue;
      const p = r.ll;
      ctx.moveTo(sx(p[0][0]), sy(p[0][1]));
      for (let i = 1; i < p.length; i++) ctx.lineTo(sx(p[i][0]), sy(p[i][1]));
    }
    ctx.strokeStyle = ink;
    ctx.globalAlpha = [0.5, 0.28, 0.2, 0.16, 0.12][cls];
    ctx.lineWidth = [3.2, 2.4, 1.8, 1.4, 1.1][cls];
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // the place itself
  const px = sx(center[0]);
  const py = sy(center[1]);
  ctx.beginPath();
  ctx.arc(px, py, 13, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.18;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(px, py, 7, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, py, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = surface;
  ctx.fill();
  ctx.restore();
}

function drawIcon(ctx, name, x, y, size, color, weight = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(iconData(name)));
  ctx.restore();
}

export function drawCard(canvas, { place, note, world, accentId = 'forest' }) {
  const t = ACCENTS.find((a) => a.id === accentId) || ACCENTS[0];
  const dpr = 2;
  canvas.width = CARD_W * dpr;
  canvas.height = CARD_H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.textBaseline = 'alphabetic';

  // paper
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // ruled grid, faint
  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = 0.05;
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_W; x += 26) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CARD_H); ctx.stroke();
  }
  for (let y = 0; y <= CARD_H; y += 26) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CARD_W, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const pad = 56;

  // header
  ctx.fillStyle = t.ink;
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('CHOWK  \u00b7  FIELD CARD', pad, 56);
  ctx.letterSpacing = '0px';
  ctx.globalAlpha = 0.55;
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }), CARD_W - pad, 56);
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;

  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, 74);
  ctx.lineTo(CARD_W - pad, 74);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // category chip
  const meta = catMeta(place.cat);
  ctx.fillStyle = t.soft;
  rr(ctx, pad, 92, ctx.measureText(meta.label.toUpperCase()).width + 46, 28, 14);
  ctx.fill();
  drawIcon(ctx, meta.icon, pad + 13, 98, 15, t.accent, 2.1);
  ctx.fillStyle = t.accent;
  ctx.font = '700 11.5px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '1.2px';
  ctx.fillText(meta.label.toUpperCase(), pad + 36, 110);
  ctx.letterSpacing = '0px';

  // title
  ctx.fillStyle = t.ink;
  ctx.font = '600 42px Fraunces, Georgia, serif';
  const titleLines = wrap(ctx, place.name, CARD_W - pad * 2, 2);
  let ty = 166;
  for (const line of titleLines) {
    ctx.fillText(line, pad, ty);
    ty += 46;
  }
  ctx.font = '400 16px Inter, system-ui, sans-serif';
  ctx.fillStyle = t.ink;
  ctx.globalAlpha = 0.7;
  const sub = wrap(ctx, kindLine(place), CARD_W - pad * 2, 1);
  ctx.fillText(sub[0] || '', pad, ty - 14);
  ctx.globalAlpha = 1;

  // map panel
  const mapY = ty + 6;
  drawMiniMap(ctx, world, [place.lon, place.lat], pad, mapY, CARD_W - pad * 2, 190, t.accent, t.ink, t.soft);

  // facts, two columns, two rows
  const st = openState(place);
  const quiet = quietScore(place);
  const ql = quietLabel(quiet);
  const facts = [
    ['OPEN NOW', st.known ? st.text : 'Hours not listed'],
    ['CALM SCORE', `${quiet} of 100, ${ql.label.toLowerCase()}`],
    ['WHERE', addressLines(place).slice(0, 2).join(', ')],
    ['COORDINATES', `${place.lat.toFixed(4)} N, ${place.lon.toFixed(4)} E`],
  ];
  const colW = (CARD_W - pad * 2 - 28) / 2;
  let fy = mapY + 228;
  facts.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = pad + col * (colW + 28);
    const y = fy + row * 58;
    ctx.fillStyle = t.accent;
    ctx.font = '700 10px Inter, system-ui, sans-serif';
    ctx.letterSpacing = '1.1px';
    ctx.fillText(label, x, y);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = t.ink;
    ctx.font = '500 15px Inter, system-ui, sans-serif';
    const lines = wrap(ctx, value, colW, 1);
    ctx.fillText(lines[0] || '', x, y + 21);
  });
  fy += 116;

  // note block
  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, fy);
  ctx.lineTo(CARD_W - pad, fy);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = t.accent;
  ctx.font = '700 10px Inter, system-ui, sans-serif';
  ctx.letterSpacing = '1.1px';
  ctx.fillText(note ? 'YOUR NOTE' : 'A NOTE ON THE STREET', pad, fy + 30);

  // a quiet score tick row
  ctx.textAlign = 'right';
  ctx.fillStyle = t.ink;
  ctx.globalAlpha = 0.55;
  ctx.font = '600 10.5px Inter, system-ui, sans-serif';
  ctx.fillText(`${Math.round(quiet)}/100 CALM`, CARD_W - pad, fy + 30);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.letterSpacing = '0px';
  ctx.fillStyle = t.soft;
  rr(ctx, CARD_W - pad - 92, fy + 37, 92, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = t.accent;
  rr(ctx, CARD_W - pad - 92, fy + 37, Math.max(6, 92 * (quiet / 100)), 5, 2.5);
  ctx.fill();

  ctx.fillStyle = t.ink;
  ctx.font = '400 21px Fraunces, Georgia, serif';
  const noteText = note || guideNote(place) + '.';
  const noteLines = wrap(ctx, noteText, CARD_W - pad * 2, 2);
  let ny = fy + 64;
  for (const line of noteLines) {
    ctx.fillText(line, pad, ny);
    ny += 30;
  }

  // footer rule sits below the note, the body above stays airy
  // footer
  ctx.strokeStyle = t.ink;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.moveTo(pad, CARD_H - 78);
  ctx.lineTo(CARD_W - pad, CARD_H - 78);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = t.ink;
  ctx.font = '600 12px Inter, system-ui, sans-serif';
  ctx.fillText('Chowk, a survey of central Bengaluru', pad, CARD_H - 50);
  ctx.font = '400 11px Inter, system-ui, sans-serif';
  ctx.globalAlpha = 0.6;
  ctx.fillText('Survey data OpenStreetMap contributors, ODbL 1.0', pad, CARD_H - 32);
  ctx.globalAlpha = 1;

  // stamp
  ctx.save();
  ctx.translate(CARD_W - pad - 40, CARD_H - 52);
  ctx.rotate(-0.12);
  ctx.strokeStyle = t.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = t.accent;
  ctx.font = '700 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SURVEYED', 0, -2);
  ctx.font = '700 13px Fraunces, Georgia, serif';
  ctx.fillText('2026', 0, 12);
  ctx.restore();

  return t;
}

export function cardSvgFallback() {
  return null;
}

export const CARD_ACCENTS = ACCENTS;
export const CARD_SIZE = [CARD_W, CARD_H];
