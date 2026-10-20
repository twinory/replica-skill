// Hand-drawn 24x24 stroke icon set, shared by the DOM and the canvas.
// Every icon is a single path so it can be turned into a Path2D.

const P = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20.5 20.5l-4.2-4.2',
  close: 'M6 6l12 12M18 6L6 18',
  locate: 'M12 3v2M12 19v2M3 12h2M19 12h2M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3',
  layers: 'M12 3 3 8l9 5 9-5-9-5M3 12l9 5 9-5M3 16l9 5 9-5',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M15.5 8.5l-2 5-5 2 2-5 5-2',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  bookmark: 'M7 3h10a1 1 0 0 1 1 1v17l-6-4-6 4V4a1 1 0 0 1 1-1z',
  heart: 'M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9z',
  navigate: 'M12 3 20 21l-8-5-8 5z',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 7l4-4 4 4',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8v4.5l3 2',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c2.5 2.4 4 5.6 4 9s-1.5 6.6-4 9c-2.5-2.4-4-5.6-4-9s1.5-6.6 4-9',
  wheelchair: 'M12 4.2a1.3 1.3 0 1 0 0 .1M12 7v5h4l2 5M12 12l-1.4 3.2a4.6 4.6 0 1 0 6.2 4.6',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 11v6M12 7.4v.2',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronDown: 'M5 9l7 7 7-7',
  chevronUp: 'M5 15l7-7 7 7',
  swap: 'M7 4v13M4 14l3 3 3-3M17 20V7M14 10l3-3 3 3',
  walk: 'M13 4.5a1.4 1.4 0 1 0 0 .1M12 7l-1 5 3 2 1 6M11 12l-3 3-1 4M9 9.5 6.5 11',
  bike: 'M6 19a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M18 19a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M6 15.5l4-6h6l2 6M9 6h3l2 3.5',
  car: 'M5 16v-3.2L7 8h10l2 4.8V16M5 16h14M8 16v2M16 16v2M7.5 12.5h9',
  train: 'M7 4h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M5 9h14M9 13h.1M15 13h.1M8 17l-2 3M16 17l2 3',
  bus: 'M6 4h12v12H6zM6 9h12M9 16v3M15 16v3M9 12h.1M15 12h.1',
  fuel: 'M5 20V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15M4 20h10M5 11h8M15 8l3 2v7a2 2 0 0 0 4 0V9l-3-3',
  coffee: 'M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5zM16 9h2a2.5 2.5 0 0 1 0 5h-2M5 21h13M8 3v2M12 2v3',
  food: 'M7 3v7a2 2 0 0 0 4 0V3M9 10v11M16 3c-1.5 2-2 3.5-2 6 0 1.5 1 2.5 2 2.5V21',
  bag: 'M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2',
  tree: 'M12 21v-5M8.5 16h7M12 16a5 5 0 0 1-3-9 5 5 0 0 1 9 2 4 4 0 0 1-1 7z',
  museum: 'M4 21h16M5 21V10M9.5 21V10M14.5 21V10M19 21V10M3 10l9-6 9 6z',
  bed: 'M3 19v-8M3 15h18v4M21 15v-3a2 2 0 0 0-2-2h-6v5M7.5 10.5h.1',
  health: 'M9 4h6v5h5v6h-5v5H9v-5H4V9h5z',
  civic: 'M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.1M15 10h.1',
  office: 'M4 21V6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v15M15 10h4a1 1 0 0 1 1 1v10M4 21h17M8 9h3M8 13h3M8 17h3',
  school: 'M12 3 2 8l10 5 10-5zM6 11v5c0 2 3 3.5 6 3.5s6-1.5 6-3.5v-5',
  temple: 'M12 3c3 3 5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 2-6 5-9zM12 17v4',
  pin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  flag: 'M5 21V4M5 5h12l-2.5 3.5L17 12H5',
  printer: 'M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z',
  download: 'M12 3v12M8 11l4 4 4-4M4 19h16',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  moon: 'M20 14a8 8 0 0 1-10-10 8.5 8.5 0 1 0 10 10z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
  contrast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 3v18',
  keyboard: 'M3 7h18v10H3zM7 11h.1M11 11h.1M15 11h.1M7 14h10',
  note: 'M4 5h16v11l-4 4H4zM16 20v-4h4',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.1M3.5 12h.1M3.5 18h.1',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  arrowUp: 'M12 20V4M6 10l6-6 6 6',
  arrowRight: 'M4 12h16M14 6l6 6-6 6',
  arrowLeft: 'M20 12H4M10 6l-6 6 6 6',
  arrowDown: 'M12 4v16M6 14l6 6 6-6',
  arrowUpRight: 'M6 18 18 6M9 6h9v9',
  arrowUpLeft: 'M18 18 6 6M15 6H6v9',
  uturn: 'M7 20V10a4 4 0 0 1 8 0v6M11 12l4 4 4-4',
  roundabout: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 16v5M8 12H4',
  ticket: 'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM12 6v12',
  check: 'M5 12.5 10 17.5 19 7',
  warning: 'M12 4 2.5 20h19zM12 10v4M12 17v.2',
  book: 'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  rupee: 'M7 4h10M7 9h10M8 4c4.5 0 6.5 2 6.5 5S12.5 14 8 14H7l7 6',
  grid: 'M4 4h16v16H4zM4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16',
  crosshair: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  ruler: 'M3 9l6-6 12 12-6 6zM7 7l2 2M10 4l2 2M13 7l2 2M16 10l2 2',
  dot: 'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
  home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z',
  work: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z',
  shuffle: 'M4 7h4l8 10h4M4 17h4l2-2.5M14 8.5 16 7h4M17 4l3 3-3 3M17 14l3 3-3 3',
  plusCircle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8v8M8 12h8',
  dotdotdot: 'M6 12h.1M12 12h.1M18 12h.1',
  timer: 'M12 8v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M9 2h6',
  therm: 'M12 4a2 2 0 0 1 2 2v7a4 4 0 1 1-4 0V6a2 2 0 0 1 2-2zM12 9v5',
  waves: 'M3 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2',
};

export function icon(name, size = 18, cls = '') {
  const d = P[name] || P.dot;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}><path d="${d}"/></svg>`;
}

const cache = new Map();
export function path2d(name) {
  if (!cache.has(name)) cache.set(name, new Path2D(P[name] || P.dot));
  return cache.get(name);
}

export function iconData(name) {
  return P[name] || P.dot;
}

export const CATS = {
  food:    { label: 'Food & drink', short: 'Food', plural: 'places to eat', icon: 'food', color: '#c2410c' },
  cafe:    { label: 'Cafes', short: 'Cafes', plural: 'cafes', icon: 'coffee', color: '#a16207' },
  shop:    { label: 'Shopping', short: 'Shops', plural: 'shops', icon: 'bag', color: '#7c5cbf' },
  culture: { label: 'Arts & culture', short: 'Culture', plural: 'cultural spots', icon: 'museum', color: '#0f766e' },
  park:    { label: 'Parks & sport', short: 'Parks', plural: 'green spaces', icon: 'tree', color: '#4d7c0f' },
  transit: { label: 'Transit', short: 'Transit', plural: 'transit stops', icon: 'train', color: '#1d4ed8' },
  health:  { label: 'Health', short: 'Health', plural: 'health services', icon: 'health', color: '#b91c1c' },
  civic:   { label: 'Everyday', short: 'Everyday', plural: 'everyday services', icon: 'civic', color: '#475569' },
  stay:    { label: 'Stay', short: 'Stay', plural: 'places to stay', icon: 'bed', color: '#9d174d' },
  office:  { label: 'Work', short: 'Work', plural: 'workplaces', icon: 'office', color: '#57534e' },
  edu:     { label: 'Learning', short: 'Learning', plural: 'places to learn', icon: 'school', color: '#0e7490' },
  worship: { label: 'Worship', short: 'Worship', plural: 'places of worship', icon: 'temple', color: '#92400e' },
};

export const CAT_ORDER = ['food', 'cafe', 'culture', 'park', 'shop', 'transit', 'health', 'civic', 'stay', 'edu', 'office', 'worship'];

export function catMeta(cat) {
  return CATS[cat] || CATS.civic;
}
