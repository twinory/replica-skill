// Canvas map renderer. Draws the survey, places, route and overlays.

import { project, worldScale, metersPerPixel } from './proj.js';
import { clamp, haversine, pointInPolygon as pointInPoly } from './geo.js';
import { iconData, catMeta, CATS } from './icons.js';

const ROAD_W = [10, 8, 6.4, 4.8, 3.2, 1.7];
const ROAD_MIN_ZOOM = [13, 13, 13.4, 13.8, 14.6, 15.2];
const LABEL_MAX = 15;

const METRO_COLOR = { purple: '#7c3aed', green: '#15803d' };

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function readPalette() {
  return {
    bg: css('--c-bg'),
    surface: css('--c-surface'),
    surface2: css('--c-surface-2'),
    text: css('--c-text'),
    muted: css('--c-text-muted'),
    faint: css('--c-text-faint'),
    accent: css('--c-accent'),
    marigold: css('--c-marigold'),
    border: css('--c-border'),
    park: css('--c-park'),
    parkLine: css('--c-park-line'),
    green: css('--c-green'),
    pitch: css('--c-pitch'),
    water: css('--c-water'),
    waterLine: css('--c-water-line'),
    building: css('--c-building'),
    buildingLine: css('--c-building-line'),
    road: css('--c-road'),
    casing: css('--c-road-casing'),
    roadLabel: css('--c-road-label'),
    route: css('--c-route'),
    routeAlt: css('--c-route-alt'),
    north: css('--c-north'),
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.world = world;
    this.palette = readPalette();
    this.pixel = document.createElement('canvas');
    this.heat = null;
    this.heatKey = '';
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.markers = [];
    this.icons = new Map();
    for (const name of Object.keys(CATS)) {
      const d = iconData(CATS[name].icon);
      this.icons.set(name, d);
    }
    this.roadPaths = null;
    this.roadPathZoomKey = null;
  }

  refreshPalette() {
    this.palette = readPalette();
    this.heatKey = '';
  }

  resize(w, h, dpr) {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
  }

  font(size, weight = 600, display = false) {
    return `${weight} ${size}px ${display ? 'Fraunces, Georgia, serif' : 'Inter, system-ui, sans-serif'}`;
  }

  projectPoint(cam, lon, lat, w, h) {
    const s = worldScale(cam.zoom);
    const p = project(lon, lat);
    return [(p[0] - cam.x) * s + w / 2, (p[1] - cam.y) * s + h / 2];
  }

  viewBounds(cam, w, h) {
    const s = worldScale(cam.zoom);
    return [
      cam.x - w / 2 / s, cam.y - h / 2 / s,
      cam.x + w / 2 / s, cam.y + h / 2 / s,
    ];
  }

  /** Main draw. view is the app's view state. */
  draw(view) {
    const { ctx } = this;
    const dpr = this.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (view.layers.pixel) {
      this.drawPixel(view);
      return;
    }
    this.markers = [];
    this.paint(ctx, this.w, this.h, view, { hit: true });
  }

  drawPixel(view) {
    const k = 0.34;
    const pw = Math.max(80, Math.round(this.w * k));
    const ph = Math.max(80, Math.round(this.h * k));
    if (this.pixel.width !== pw || this.pixel.height !== ph) {
      this.pixel.width = pw;
      this.pixel.height = ph;
    }
    const pctx = this.pixel.getContext('2d');
    pctx.setTransform(k, 0, 0, k, 0, 0);
    this.paint(pctx, this.w, this.h, view, { hit: false, pixel: true });
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.pixel.__native || this.pixel, 0, 0, pw, ph, 0, 0, Math.round(pw / k), Math.round(ph / k));
    ctx.imageSmoothingEnabled = true;
    if (view.hover || view.selected) this.paintSelection(ctx, this.w, this.h, view);
  }

  paint(ctx, w, h, view, opts = {}) {
    const p = this.palette;
    const cam = view.cam;
    const s = worldScale(cam.zoom);
    ctx.save();
    ctx.fillStyle = this.outsideColor();
    ctx.fillRect(0, 0, w, h);

    const b = this.world.bounds;
    const tl = this.projectPoint(cam, b[0], b[3], w, h);
    const br = this.projectPoint(cam, b[2], b[1], w, h);
    const inner = [tl[0], tl[1], br[0] - tl[0], br[1] - tl[1]];
    ctx.fillStyle = p.bg;
    ctx.fillRect(inner[0], inner[1], inner[2], inner[3]);
    this.drawHatch(ctx, inner, b);

    ctx.save();
    ctx.beginPath();
    ctx.rect(inner[0], inner[1], inner[2], inner[3]);
    ctx.clip();

    this.drawAreas(ctx, cam, w, h, s, view);
    this.drawBuildings(ctx, cam, w, h, s, view);
    this.drawRoads(ctx, cam, w, h, s, view);
    if (view.layers.busy) this.drawHeat(ctx, cam, w, h, view);
    if (view.layers.quiet) this.drawQuiet(ctx, cam, w, h, s);
    if (view.layers.transit) this.drawTransit(ctx, cam, w, h, s, view, opts);
    this.labelGrid = new Map();
    this.drawRoadLabels(ctx, cam, w, h, s, view, opts);
    this.drawAreaLabels(ctx, cam, w, h, s, view, opts);
    this.drawPlaces(ctx, cam, w, h, s, view, opts);
    if (view.route) this.drawRoute(ctx, cam, w, h, s, view, opts);
    if (view.measure && view.measure.points.length) this.drawMeasure(ctx, cam, w, h, s, view);
    if (view.user) this.drawUser(ctx, cam, w, h, s, view);
    ctx.restore();

    this.drawSurveyEdge(ctx, inner, cam, s);
    ctx.restore();
  }

  outsideColor() {
    // mix of bg and surface
    return this.palette.surface2;
  }

  drawHatch(ctx, rect, bounds) {
    const p = this.palette;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, this.h);
    ctx.rect(rect[0], rect[1], rect[2], rect[3]);
    ctx.clip('evenodd');
    ctx.strokeStyle = p.border;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    const gap = 18;
    ctx.beginPath();
    for (let x = -this.h; x < this.w + this.h; x += gap) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + this.h, this.h);
    }
    ctx.stroke();
    ctx.restore();

    // a soft inner shadow around the survey edge
    ctx.save();
    ctx.strokeStyle = p.border;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 6;
    ctx.strokeRect(rect[0] - 3, rect[1] - 3, rect[2] + 6, rect[3] + 6);
    ctx.restore();
  }

  drawAreas(ctx, cam, w, h, s, view) {
    const p = this.palette;
    const drawPolys = (list, fill, line, zmin = 0) => {
      if (cam.zoom < zmin) return;
      ctx.beginPath();
      const vb = this.viewBounds(cam, w, h);
      for (const a of list) {
        const bb = a.bounds;
        if (bb[2] < vb[0] || bb[0] > vb[2] || bb[3] < vb[1] || bb[1] > vb[3]) continue;
        const pts = a.pts;
        const [x0, y0] = this.pw(cam, pts[0], w, h, s);
        ctx.moveTo(x0, y0);
        for (let i = 1; i < pts.length; i++) {
          const [x, y] = this.pw(cam, pts[i], w, h, s);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fillStyle = fill;
      ctx.fill();
      if (line && cam.zoom >= 14.6) {
        ctx.strokeStyle = line;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    };
    if (view.layers.parks) {
      drawPolys(this.world.parks, p.park, p.parkLine, 0);
      drawPolys(this.world.pitches, p.pitch, p.parkLine, 15);
    }
    drawPolys(this.world.water, p.water, p.waterLine, 0);
  }

  drawBuildings(ctx, cam, w, h, s, view) {
    if (cam.zoom < 15.1) return;
    const p = this.palette;
    const alpha = clamp((cam.zoom - 15.1) / 1.1, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.55 + alpha * 0.45;
    ctx.beginPath();
    const minPx = 2.2;
    for (const a of this.world.buildings) {
      const bb = a.bounds;
      const x1 = (bb[0] - cam.x) * s + w / 2;
      const x2 = (bb[2] - cam.x) * s + w / 2;
      const y1 = (bb[1] - cam.y) * s + h / 2;
      const y2 = (bb[3] - cam.y) * s + h / 2;
      if (x2 < -20 || x1 > w + 20 || y2 < -20 || y1 > h + 20) continue;
      if ((x2 - x1) < minPx && (y2 - y1) < minPx) continue;
      const pts = a.pts;
      const [sx, sy] = this.pw(cam, pts[0], w, h, s);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = this.pw(cam, pts[i], w, h, s);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.fillStyle = p.building;
    ctx.fill();
    if (cam.zoom >= 16) {
      ctx.strokeStyle = p.buildingLine;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawRoads(ctx, cam, w, h, s, view) {
    const p = this.palette;
    const widths = ROAD_W.map((v, i) => {
      const w0 = v * Math.pow(1.5, cam.zoom - 16);
      return clamp(w0, i === 5 ? 0.7 : 1.1, 32);
    });
    const vb = this.viewBounds(cam, w, h);
    const visible = (r) => {
      const bb = r.bounds;
      return !(bb[2] < vb[0] || bb[0] > vb[2] || bb[3] < vb[1] || bb[1] > vb[3]);
    };
    const build = (cls) => {
      const path = new Path2D();
      for (const r of this.world.roads) {
        if (r.cls !== cls) continue;
        if (cam.zoom < ROAD_MIN_ZOOM[cls]) continue;
        if (!visible(r)) continue;
        const pts = r.pts;
        const [x0, y0] = this.pw(cam, pts[0], w, h, s);
        path.moveTo(x0, y0);
        for (let i = 1; i < pts.length; i++) {
          const [x, y] = this.pw(cam, pts[i], w, h, s);
          path.lineTo(x, y);
        }
      }
      return path;
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // casings
    for (let cls = 5; cls >= 0; cls--) {
      if (cam.zoom < ROAD_MIN_ZOOM[cls]) continue;
      const path = build(cls);
      ctx.strokeStyle = p.casing;
      ctx.lineWidth = widths[cls] + (cls < 4 ? 1.6 : 1.1);
      ctx.stroke(path);
    }
    // fills
    for (let cls = 5; cls >= 0; cls--) {
      if (cam.zoom < ROAD_MIN_ZOOM[cls]) continue;
      const path = build(cls);
      ctx.strokeStyle = cls === 5 ? p.surface : p.road;
      ctx.globalAlpha = cls === 5 ? 0.85 : 1;
      ctx.lineWidth = widths[cls];
      ctx.stroke(path);
      ctx.globalAlpha = 1;
    }
  }

  drawQuiet(ctx, cam, w, h, s) {
    const ramp = (n) => {
      if (n < 28) return '#3f8f5b';
      if (n < 45) return '#8aa83f';
      if (n < 62) return '#d9a13b';
      return '#c2410c';
    };
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const cls of [3, 2, 1, 0]) {
      if (cam.zoom < ROAD_MIN_ZOOM[cls]) continue;
      const wBase = clamp(ROAD_W[cls] * Math.pow(1.5, cam.zoom - 16) * 0.62, 1.2, 14);
      const qv = this.viewBounds(cam, w, h);
      for (const r of this.world.roads) {
        if (r.cls !== cls) continue;
        const bb = r.bounds;
        if (bb[2] < qv[0] || bb[0] > qv[2] || bb[3] < qv[1] || bb[1] > qv[3]) continue;
        const noise = this.edgeNoiseForRoad(r);
        ctx.strokeStyle = ramp(noise);
        ctx.lineWidth = wBase;
        ctx.beginPath();
        const pts = r.pts;
        const [x0, y0] = this.pw(cam, pts[0], w, h, s);
        ctx.moveTo(x0, y0);
        for (let i = 1; i < pts.length; i++) {
          const [x, y] = this.pw(cam, pts[i], w, h, s);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  edgeNoiseForRoad(road) {
    if (road.noise !== undefined) return road.noise;
    return 50;
  }

  drawTransit(ctx, cam, w, h, s, view, opts) {
    const p = this.palette;
    ctx.save();
    // lines
    for (const line of this.world.metroLines) {
      const color = METRO_COLOR[line.id] || p.accent;
      const pts = line.stopsData.map((st) => this.pw(cam, [st.wx, st.wy], w, h, s));
      if (!pts.length) continue;
      const path = new Path2D();
      path.moveTo(...pts[0]);
      for (let i = 1; i < pts.length; i++) path.lineTo(...pts[i]);
      const lw = clamp(2.6 * Math.pow(1.3, cam.zoom - 14), 2, 8);
      ctx.lineCap = 'round';
      ctx.strokeStyle = this.palette.bg;
      ctx.lineWidth = lw + 2.6;
      ctx.stroke(path);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = lw;
      ctx.setLineDash(cam.zoom < 16 ? [lw * 1.4, lw * 1.9] : []);
      ctx.stroke(path);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // stations
    for (const st of this.world.metroStations) {
      const [x, y] = this.pw(cam, [st.wx, st.wy], w, h, s);
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
      const r = clamp(2.6 * Math.pow(1.25, cam.zoom - 14), 2.2, 7);
      ctx.beginPath();
      ctx.arc(x, y, r + 1.6, 0, Math.PI * 2);
      ctx.fillStyle = p.bg;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = METRO_COLOR[st.l] || p.accent;
      ctx.fill();
      if (cam.zoom >= 14.8 && !opts.pixel) {
        ctx.font = this.font(10.5, 600);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = st.n.replace(/^Nadaprabhu Kempegowda Station /, '');
        const tw = ctx.measureText(label).width;
        const bx = x + r + 5;
        if (this.placeFree(bx - 2, y - 8, tw + 6, 16)) {
          ctx.fillStyle = p.surface;
          ctx.globalAlpha = 0.86;
          roundRect(ctx, bx - 2, y - 8, tw + 6, 16, 3);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.text;
          ctx.fillText(label, bx + 1, y + 0.5);
          this.occupy(bx - 2, y - 8, tw + 6, 16);
        }
      }
    }
    // bus stops
    if (cam.zoom >= 16.2) {
      for (const place of this.world.byCat.get('transit') || []) {
        if (place.sub !== 'bus') continue;
        const [x, y] = this.pw(cam, [place.wx, place.wy], w, h, s);
        if (x < 0 || y < 0 || x > w || y > h) continue;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = p.surface;
        ctx.fill();
        ctx.strokeStyle = '#1d4ed8';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawRoadLabels(ctx, cam, w, h, s, view, opts) {
    if (opts.pixel || cam.zoom < 15.5 || this._labelsOff) return;
    const p = this.palette;
    const cell = 48;
    const collide = (x, y, ww, hh) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const list = this.labelGrid.get((cx + i) + ',' + (cy + j));
          if (!list) continue;
          for (const r of list) {
            if (x < r[0] + r[2] && x + ww > r[0] && y < r[1] + r[3] && y + hh > r[1]) return true;
          }
        }
      }
      const key = cx + ',' + cy;
      if (!this.labelGrid.has(key)) this.labelGrid.set(key, []);
      this.labelGrid.get(key).push([x, y, ww, hh]);
      return false;
    };

    const byName = new Map();
    const vb = this.viewBounds(cam, w, h);
    for (const r of this.world.roads) {
      if (!r.name || r.cls > 2) continue;
      if (cam.zoom < 15.5 + r.cls * 0.25) continue;
      const bb = r.bounds;
      if (bb[2] < vb[0] || bb[0] > vb[2] || bb[3] < vb[1] || bb[1] > vb[3]) continue;
      if (!byName.has(r.name)) byName.set(r.name, []);
      byName.get(r.name).push(r);
    }
    const items = [...byName.entries()];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const [name, roads] of items) {
      const size = roads[0].cls === 0 ? 11.5 : roads[0].cls === 1 ? 10.5 : 10;
      ctx.font = this.font(size, 650);
      const tw = ctx.measureText(name).width;
      let placed = false;
      for (const r of roads) {
        if (placed) break;
        const pts = r.pts;
        const screen = pts.map((pt) => this.pw(cam, pt, w, h, s));
        if (screen.length < 2) continue;
        // walk along and try a few positions
        let acc = 0;
        for (let i = 1; i < screen.length; i++) {
          const [x1, y1] = screen[i - 1];
          const [x2, y2] = screen[i];
          const segLen = Math.hypot(x2 - x1, y2 - y1);
          if (acc + segLen < 40) { acc += segLen; continue; }
          acc = 0;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          if (mx < tw / 2 + 8 || mx > w - tw / 2 - 8 || my < 16 || my > h - 16) continue;
          let ang = Math.atan2(y2 - y1, x2 - x1);
          if (ang > Math.PI / 2) ang -= Math.PI;
          if (ang < -Math.PI / 2) ang += Math.PI;
          const cw = Math.abs(Math.cos(ang)) * tw + Math.abs(Math.sin(ang)) * 12;
          const ch = Math.abs(Math.sin(ang)) * tw + Math.abs(Math.cos(ang)) * 12;
          if (collide(mx - cw / 2, my - ch / 2, cw, ch)) continue;
          ctx.save();
          ctx.translate(mx, my);
          ctx.rotate(ang);
          ctx.strokeStyle = p.bg;
          ctx.lineWidth = 3.4;
          ctx.strokeText(name, 0, 0);
          ctx.fillStyle = p.roadLabel;
          ctx.fillText(name, 0, 0);
          ctx.restore();
          placed = true;
          break;
        }
      }
    }
  }

  drawAreaLabels(ctx, cam, w, h, s, view, opts) {
    if (opts.pixel || cam.zoom < 15.2) return;
    const p = this.palette;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const a of this.world.parks) {
      if (!a.n || a.n.length > 34) continue;
      const c = a.ll.reduce((acc, pt) => [acc[0] + pt[0] / a.ll.length, acc[1] + pt[1] / a.ll.length], [0, 0]);
      const [x, y] = this.projectPoint(cam, c[0], c[1], w, h);
      if (x < 40 || y < 20 || x > w - 40 || y > h - 20) continue;
      if (cam.zoom < 15.6 + (a.n.length > 18 ? 0.6 : 0)) continue;
      ctx.font = this.font(9.5, 700);
      const label = a.n.toUpperCase();
      const tw = ctx.measureText(label).width;
      if (!pointInPoly(x, y, a.ll)) continue;
      if (!this.placeFree(x - tw / 2, y - 7, tw, 14)) continue;
      ctx.strokeStyle = p.bg;
      ctx.lineWidth = 3;
      ctx.strokeText(label, x, y);
      ctx.fillStyle = '#4d6b3a';
      if (document.documentElement.dataset.theme === 'dark') ctx.fillStyle = '#9ab883';
      ctx.fillText(label, x, y);
    }
    ctx.restore();
  }

  drawPlaces(ctx, cam, w, h, s, view, opts) {
    const p = this.palette;
    const visited = [];
    const cache = [];
    const chip = cam.zoom >= 16.25 && !opts.pixel;
    const dot = cam.zoom >= 14.8;
    if (!dot) {
      this.markerCache = [];
      return;
    }
    const weight = (pl) => {
      const w0 = { culture: 9, transit: 8, food: 7, park: 6, shop: 5, cafe: 5, worship: 4, stay: 3, edu: 3, health: 2, civic: 1, office: 1 }[pl.cat] || 1;
      return w0;
    };
    const list = this.world.places
      .map((pl) => ({ pl, x: (pl.wx - cam.x) * s + w / 2, y: (pl.wy - cam.y) * s + h / 2, w: weight(pl) }))
      .filter((o) => o.x > -30 && o.y > -30 && o.x < w + 30 && o.y < h + 30)
      .filter((o) => {
        if (o.pl.cat === 'transit') return false; // drawn by the transit layer
        if (view.layers.accessibility) return o.pl.tags.wheelchair === 'yes' || o.pl.tags.wheelchair === 'limited';
        return true;
      })
      .sort((a, b) => b.w - a.w);

    // screen-space declutter: one marker per ~18px at low zoom, more room for chips
    const grid = new Map();
    const cell = chip ? 30 : 20;
    const occupied = (x, y) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        if (grid.has((cx + i) + ',' + (cy + j))) return true;
      }
      grid.set(cx + ',' + cy, 1);
      return false;
    };

    for (const o of list) {
      if (chip) {
        if (o.w < 3 && cam.zoom < 17) continue;
      } else if (o.w < 5 && cam.zoom < 16) continue;
      if (occupied(o.x, o.y)) continue;
      const meta = catMeta(o.pl.cat);
      const color = meta.color;
      const hovered = view.hover === o.pl.id;
      const selected = view.selected === o.pl.id;
      if (chip) {
        const r = 8;
        ctx.beginPath();
        ctx.arc(o.x, o.y, r + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = p.bg;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(o.x, o.y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.save();
        ctx.translate(o.x - 5, o.y - 5);
        ctx.scale(10 / 24, 10 / 24);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke(new Path2D(iconData(meta.icon)));
        ctx.restore();
        // label
        if (cam.zoom >= 16.6 && !selected) {
          ctx.font = this.font(11, 600);
          const tw = ctx.measureText(o.pl.name).width;
          const lx = o.x + r + 4;
          if (lx + tw < w - 4 && this.placeFree(lx - 1, o.y - 8, tw + 4, 16)) {
            ctx.strokeStyle = p.bg;
            ctx.lineWidth = 3.2;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.strokeText(o.pl.name, lx, o.y + 0.5);
            ctx.fillStyle = hovered ? p.text : p.roadLabel;
            ctx.fillText(o.pl.name, lx, o.y + 0.5);
          }
        }
      } else {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.w >= 7 ? 3.6 : 2.6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(o.x, o.y, (o.w >= 7 ? 3.6 : 2.6) + 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = p.bg;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      cache.push({ id: o.pl.id, x: o.x, y: o.y, r: chip ? 11 : 7, place: o.pl });
    }
    this.markerCache = cache;
    // hover ring on top
    if (view.hover) {
      const m = cache.find((c) => c.id === view.hover);
      if (m) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = p.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  placeFree(x, y, w, h) {
    if (!this.labelGrid) this.labelGrid = new Map();
    const cell = 48;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        const list = this.labelGrid.get((cx + i) + ',' + (cy + j));
        if (!list) continue;
        for (const r of list) {
          if (x < r[0] + r[2] && x + w > r[0] && y < r[1] + r[3] && y + h > r[1]) return false;
        }
      }
    }
    this.occupy(x, y, w, h);
    return true;
  }

  occupy(x, y, w, h) {
    if (!this.labelGrid) this.labelGrid = new Map();
    const cell = 48;
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    const key = cx + ',' + cy;
    if (!this.labelGrid.has(key)) this.labelGrid.set(key, []);
    this.labelGrid.get(key).push([x, y, w, h]);
  }

  drawRoute(ctx, cam, w, h, s, view, opts) {
    const p = this.palette;
    const route = view.route;
    const options = route.options || [];
    const selected = options[route.selected] || options[0];
    if (!selected) return;
    const toPath = (geom) => {
      const pts = geom.map((pt) => this.projectPoint(cam, pt[0], pt[1], w, h));
      const path = new Path2D();
      if (!pts.length) return path;
      path.moveTo(...pts[0]);
      for (let i = 1; i < pts.length; i++) path.lineTo(...pts[i]);
      return path;
    };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // alternatives under the selected route
    for (let i = 0; i < options.length; i++) {
      if (i === route.selected) continue;
      const geo = options[i].geometry;
      if (!geo || geo.length < 2) continue;
      ctx.strokeStyle = p.bg;
      ctx.lineWidth = 6;
      ctx.globalAlpha = 0.9;
      ctx.stroke(toPath(geo));
      ctx.strokeStyle = p.routeAlt;
      ctx.lineWidth = 4;
      ctx.stroke(toPath(geo));
      ctx.globalAlpha = 1;
    }
    // selected
    const geo = selected.geometry;
    if (selected.mode === 'transit' && selected.legs) {
      for (const leg of selected.legs) {
        if (leg.type === 'walk') {
          ctx.save();
          ctx.setLineDash([2, 7]);
          ctx.strokeStyle = p.route;
          ctx.lineWidth = 5;
          ctx.lineCap = 'round';
          ctx.stroke(toPath(leg.geometry));
          ctx.restore();
        } else {
          const lineId = leg.rides?.[0]?.line?.id;
          const color = METRO_COLOR[lineId] || p.route;
          ctx.strokeStyle = p.bg;
          ctx.lineWidth = 9;
          ctx.stroke(toPath(leg.geometry));
          ctx.strokeStyle = color;
          ctx.lineWidth = 6;
          ctx.stroke(toPath(leg.geometry));
        }
      }
    } else if (geo && geo.length > 1) {
      ctx.strokeStyle = p.bg;
      ctx.lineWidth = 9;
      ctx.stroke(toPath(geo));
      ctx.strokeStyle = p.route;
      ctx.lineWidth = 6;
      ctx.stroke(toPath(geo));
      // chevrons
      if (cam.zoom > 15 && !opts.pixel) this.drawChevrons(ctx, cam, w, h, geo, p.onRoute || '#fff');
    }
    // endpoints
    const end = route.destination;
    const start = route.origin;
    if (start) this.drawOrigin(ctx, cam, w, h, start);
    if (end) this.drawDestination(ctx, cam, w, h, end);
    if (route.waypoints) {
      route.waypoints.forEach((wp, i) => {
        const [x, y] = this.projectPoint(cam, wp.lon, wp.lat, w, h);
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.fillStyle = p.surface;
        ctx.fill();
        ctx.strokeStyle = p.marigold;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = p.text;
        ctx.font = this.font(10, 700);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x, y + 0.5);
      });
    }
    ctx.restore();
  }

  drawChevrons(ctx, cam, w, h, geo, color) {
    let acc = 0;
    const step = 74;
    for (let i = 1; i < geo.length; i++) {
      const [x1, y1] = this.projectPoint(cam, geo[i - 1][0], geo[i - 1][1], w, h);
      const [x2, y2] = this.projectPoint(cam, geo[i][0], geo[i][1], w, h);
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (!len) continue;
      acc += len;
      if (acc < step) continue;
      acc = 0;
      const ang = Math.atan2(y2 - y1, x2 - x1);
      ctx.save();
      ctx.translate(x2, y2);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(-3, -3.4);
      ctx.lineTo(2.4, 0);
      ctx.lineTo(-3, 3.4);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }
  }

  drawOrigin(ctx, cam, w, h, pt) {
    const [x, y] = this.projectPoint(cam, pt.lon, pt.lat, w, h);
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = this.palette.surface;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = this.palette.route;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fillStyle = this.palette.surface;
    ctx.fill();
  }

  drawDestination(ctx, cam, w, h, pt) {
    const [x, y] = this.projectPoint(cam, pt.lon, pt.lat, w, h);
    const p = this.palette;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - 2);
    ctx.bezierCurveTo(x - 9, y - 9, x - 12, y - 12, x - 12, y - 17);
    ctx.arc(x, y - 17, 12, Math.PI, 0);
    ctx.bezierCurveTo(x + 12, y - 12, x + 9, y - 9, x, y - 2);
    ctx.fillStyle = p.marigold;
    ctx.fill();
    ctx.strokeStyle = p.surface;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 17, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = p.surface;
    ctx.fill();
    ctx.restore();
  }

  drawMeasure(ctx, cam, w, h, s, view) {
    const p = this.palette;
    const pts = view.measure.points.map((pt) => this.projectPoint(cam, pt[0], pt[1], w, h));
    if (view.measure.cursor) pts.push(this.projectPoint(cam, view.measure.cursor[0], view.measure.cursor[1], w, h));
    if (pts.length < 2) return;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]);
    ctx.strokeStyle = p.marigold;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      ctx.beginPath();
      ctx.arc(x2, y2, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.marigold;
      ctx.fill();
    }
    for (let i = 1; i < view.measure.points.length; i++) {
      total += haversine(view.measure.points[i - 1][0], view.measure.points[i - 1][1], view.measure.points[i][0], view.measure.points[i][1]);
    }
    const last = pts[pts.length - 1];
    const label = total >= 1000 ? (total / 1000).toFixed(2) + ' km' : Math.round(total) + ' m';
    ctx.font = this.font(11, 700);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = p.marigold;
    roundRect(ctx, last[0] + 8, last[1] - 24, tw + 14, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, last[0] + 15, last[1] - 13.5);
  }

  drawUser(ctx, cam, w, h, s, view) {
    const [x, y] = this.projectPoint(cam, view.user.lon, view.user.lat, w, h);
    const p = this.palette;
    if (view.user.accuracy) {
      const r = Math.max(8, view.user.accuracy / metersPerPixel(view.user.lat, cam.zoom));
      ctx.beginPath();
      ctx.arc(x, y, Math.min(r, 400), 0, Math.PI * 2);
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.12;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = p.surface;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
  }

  drawHeat(ctx, cam, w, h, view) {
    const key = view.hour + '|' + ++this.heatKeyTick;
    if (!this.heat || this.heatHour !== view.hour) {
      this.heat = this.buildHeat(view.hour);
      this.heatHour = view.hour;
    }
    const b = this.world.bounds;
    const [x1, y1] = this.projectPoint(cam, b[0], b[3], w, h);
    const [x2, y2] = this.projectPoint(cam, b[2], b[1], w, h);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.globalCompositeOperation = 'multiply';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.heat.__native || this.heat, x1, y1, x2 - x1, y2 - y1);
    ctx.restore();
  }

  buildHeat(hour) {
    const W = 160, H = 120;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const b = this.world.bounds;
    const g = (mu, sigma) => Math.exp(-((hour - mu) ** 2) / (2 * sigma * sigma));
    const curve = 0.35 + g(9.5, 2.2) * 0.35 + g(13.4, 3.2) * 0.55 + g(19.6, 2.6) * 0.9;
    const base = { food: 1, cafe: 0.75, shop: 0.5, culture: 0.55, transit: 0.9, park: 0.35, health: 0.2, civic: 0.2, stay: 0.2, edu: 0.15, office: 0.15, worship: 0.1 };
    const grid = new Float32Array(W * H);
    for (const pl of this.world.places) {
      if (pl.cat === 'transit' || pl.cat === 'office') continue;
      const gx = ((pl.lon - b[0]) / (b[2] - b[0])) * W;
      const gy = ((b[3] - pl.lat) / (b[3] - b[1])) * H;
      const amp = (base[pl.cat] || 0.2) * curve;
      const rad = 4;
      for (let dy = -rad * 2; dy <= rad * 2; dy++) {
        for (let dx = -rad * 2; dx <= rad * 2; dx++) {
          const x = Math.round(gx) + dx;
          const y = Math.round(gy) + dy;
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const d = Math.hypot(dx, dy) / rad;
          if (d > 1.8) continue;
          grid[y * W + x] += amp * Math.exp(-d * d * 1.8);
        }
      }
    }
    let max = 0.0001;
    for (const v of grid) if (v > max) max = v;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < grid.length; i++) {
      const t = Math.min(1, grid[i] / (max * 0.62));
      if (t < 0.02) continue;
      const [r, gg, bb] = heatColor(t);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = gg;
      img.data[i * 4 + 2] = bb;
      img.data[i * 4 + 3] = Math.round(200 * Math.pow(t, 0.7));
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  drawSurveyEdge(ctx, rect, cam, s) {
    const p = this.palette;
    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = p.border;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(rect[0], rect[1], rect[2], rect[3]);
    ctx.setLineDash([]);
    const len = 14;
    const corners = [[rect[0], rect[1]], [rect[0] + rect[2], rect[1]], [rect[0], rect[1] + rect[3]], [rect[0] + rect[2], rect[1] + rect[3]]];
    ctx.strokeStyle = p.muted;
    ctx.lineWidth = 1.6;
    for (const [x, y] of corners) {
      const sx = Math.sign(x - (rect[0] + rect[2] / 2)) || 1;
      const sy = Math.sign(y - (rect[1] + rect[3] / 2)) || 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * sx, y);
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + len * sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  paintSelection(ctx, w, h, view) {
    for (const id of [view.hover, view.selected]) {
      if (!id) continue;
      const m = this.markers.find((x) => x.id === id);
      if (!m) continue;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = this.palette.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  pw(cam, pt, w, h, s) {
    return [(pt[0] - cam.x) * s + w / 2, (pt[1] - cam.y) * s + h / 2];
  }

  screenOf(lon, lat, cam, w, h) {
    return this.projectPoint(cam, lon, lat, w, h);
  }

  hitTest(x, y, radius = 14) {
    let best = null;
    let bestD = radius * radius;
    for (const m of this.markers) {
      const d = (m.x - x) ** 2 + (m.y - y) ** 2;
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }

  roadAt(x, y, cam, w, h, tol = 5) {
    let best = null;
    let bd = tol * tol;
    for (const r of this.world.roads) {
      if (!r.name || r.cls > 2) continue;
      const pts = r.pts.map((pt) => this.pw(cam, pt, w, h, worldScale(cam.zoom)));
      for (let i = 1; i < pts.length; i++) {
        const [x1, y1] = pts[i - 1];
        const [x2, y2] = pts[i];
        const dx = x2 - x1, dy = y2 - y1;
        const l2 = dx * dx + dy * dy;
        let t = l2 ? ((x - x1) * dx + (y - y1) * dy) / l2 : 0;
        t = clamp(t, 0, 1);
        const px = x1 + t * dx, py = y1 + t * dy;
        const d = (x - px) ** 2 + (y - py) ** 2;
        if (d < bd) { bd = d; best = r; }
      }
    }
    return best;
  }
}

function heatColor(t) {
  // warm ramp: pale yellow through orange to deep red
  const stops = [
    [0, [255, 237, 190]],
    [0.4, [247, 180, 92]],
    [0.7, [224, 108, 51]],
    [1, [166, 42, 30]],
  ];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * k));
    }
  }
  return stops[stops.length - 1][1];
}

export { METRO_COLOR };
