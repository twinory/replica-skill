// Web Mercator projection and a camera that fits lon/lat into a viewport.

import { clamp } from './geo.js';

export const TILE = 256;
export const MIN_ZOOM = 12.6;
export const MAX_ZOOM = 19.6;

export function project(lon, lat) {
  const x = (lon + 180) / 360;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return [x, y];
}

export function unproject(x, y) {
  const lon = x * 360 - 180;
  const n = Math.PI * (1 - 2 * y);
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return [lon, lat];
}

export const worldScale = (zoom) => TILE * Math.pow(2, zoom);

export function makeCamera(lon, lat, zoom) {
  return { lon, lat, zoom, x: project(lon, lat)[0], y: project(lon, lat)[1] };
}

export function setCamera(cam, lon, lat, zoom) {
  cam.lon = lon;
  cam.lat = lat;
  cam.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  const p = project(lon, lat);
  cam.x = p[0];
  cam.y = p[1];
  return cam;
}

export function camWorld(cam) {
  const s = worldScale(cam.zoom);
  return { scale: s, cx: cam.x * s, cy: cam.y * s };
}

export function toScreen(cam, w, h, lon, lat) {
  const s = worldScale(cam.zoom);
  const p = project(lon, lat);
  return [p[0] * s - cam.x * s + w / 2, p[1] * s - cam.y * s + h / 2];
}

export function toScreenWorld(cam, w, h, wx, wy) {
  const s = worldScale(cam.zoom);
  return [wx * s - cam.x * s + w / 2, wy * s - cam.y * s + h / 2];
}

export function fromScreen(cam, w, h, sx, sy) {
  const s = worldScale(cam.zoom);
  const wx = (sx - w / 2 + cam.x * s) / s;
  const wy = (sy - h / 2 + cam.y * s) / s;
  const [lon, lat] = unproject(wx, wy);
  return { lon, lat, wx, wy };
}

/** Zoom at which bounds fit in w x h with padding. */
export function zoomToFit(bounds, w, h, pad = 48, min = MIN_ZOOM, max = 18) {
  const [w1, y1] = project(bounds[0], bounds[3]);
  const [w2, y2] = project(bounds[2], bounds[1]);
  const dw = Math.abs(w2 - w1);
  const dh = Math.abs(y2 - y1);
  const zx = Math.log2(Math.max(1, w - pad * 2) / (TILE * dw));
  const zy = Math.log2(Math.max(1, h - pad * 2) / (TILE * dh));
  return clamp(Math.min(zx, zy), min, max);
}

/** Zoom so the bounds cover the viewport (the larger of the two axes). */
export function coverCamera(bounds, w, h, max = 18) {
  const [w1, y1] = project(bounds[0], bounds[3]);
  const [w2, y2] = project(bounds[2], bounds[1]);
  const dw = Math.abs(w2 - w1);
  const dh = Math.abs(y2 - y1);
  const zx = Math.log2(Math.max(1, w) / (TILE * dw));
  const zy = Math.log2(Math.max(1, h) / (TILE * dh));
  return setCamera({}, (bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2,
    clamp(Math.max(zx, zy), MIN_ZOOM, max));
}

/** Keep the camera centre inside bounds, so panning cannot drift into the void. */
export function clampCamera(cam, bounds, w, h, margin = 0) {
  const s = worldScale(cam.zoom);
  const [x1, y1] = project(bounds[0], bounds[3]);
  const [x2, y2] = project(bounds[2], bounds[1]);
  const halfW = (w / 2) / s - margin;
  const halfH = (h / 2) / s - margin;
  let minX = x1 + halfW, maxX = x2 - halfW;
  let minY = y1 + halfH, maxY = y2 - halfH;
  if (minX > maxX) { minX = maxX = (x1 + x2) / 2; }
  if (minY > maxY) { minY = maxY = (y1 + y2) / 2; }
  const cx = clamp(cam.x, minX, maxX);
  const cy = clamp(cam.y, minY, maxY);
  if (cx !== cam.x || cy !== cam.y) {
    cam.x = cx;
    cam.y = cy;
    const [lon, lat] = unproject(cx, cy);
    cam.lon = lon;
    cam.lat = lat;
  }
  return cam;
}

export function fitCamera(bounds, w, h, pad = 48, max = 18) {
  const zoom = zoomToFit(bounds, w, h, pad, MIN_ZOOM, max);
  return setCamera({}, (bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2, zoom);
}

/** Keep the lon/lat under (px, py) fixed while the zoom changes. */
export function zoomAround(cam, w, h, px, py, nextZoom) {
  const before = fromScreen(cam, w, h, px, py);
  const z = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const s = worldScale(z);
  const lon = before.lon;
  const lat = before.lat;
  const p = project(lon, lat);
  cam.zoom = z;
  cam.x = p[0] - (px - w / 2) / s;
  cam.y = p[1] - (py - h / 2) / s;
  const c = unproject(cam.x, cam.y);
  cam.lon = c[0];
  cam.lat = c[1];
  return cam;
}

export function panBy(cam, dx, dy) {
  const s = worldScale(cam.zoom);
  cam.x -= dx / s;
  cam.y -= dy / s;
  const [lon, lat] = unproject(cam.x, cam.y);
  cam.lon = lon;
  cam.lat = lat;
  return cam;
}

export function visibleBounds(cam, w, h) {
  const tl = fromScreen(cam, w, h, 0, 0);
  const br = fromScreen(cam, w, h, w, h);
  return [tl.lon, br.lat, br.lon, tl.lat];
}

export function metersPerPixel(lat, zoom) {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}
