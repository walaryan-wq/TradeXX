/** Stage geometry and explicit card-matrix layout (pure functions; no DOM). */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Geom {
  W: number;
  H: number;
  ui: number;
  axisX: number; // x of the vertical gradient axis bar
  plot: { x0: number; x1: number; top: number; bottom: number };
  histo: { x0: number; x1: number; top: number; bottom: number };
  strip: { x0: number; x1: number };
  corridor: { x0: number; x1: number };
  matrix: { x0: number; x1: number; top: number; bottom: number };
}

/** Horizontal proportions (of stage width). Starting estimates tuned against the reference frames. */
export const PROPORTIONS = { field: 0.44, strip: 0.04, corridor: 0.1, matrix: 0.42 };

export function computeGeom(W: number, H: number, density: number): Geom {
  const ui = density * Math.max(0.8, Math.min(1.5, Math.min(W / 1860, H / 1010)));
  const left = 6;
  const right = 6;
  const usable = W - left - right;
  const axisX = left + 30 * ui;
  const fieldX1 = left + usable * PROPORTIONS.field;
  const stripX1 = fieldX1 + usable * PROPORTIONS.strip;
  const corridorX1 = stripX1 + usable * PROPORTIONS.corridor;
  const histoTop = 6;
  const histoBottom = histoTop + 64 * ui;
  const plotTop = histoBottom + 14 * ui;
  const plotBottom = H - 22 * ui;
  return {
    W,
    H,
    ui,
    axisX,
    plot: { x0: axisX + 10 * ui, x1: fieldX1, top: plotTop, bottom: plotBottom },
    histo: { x0: axisX + 10 * ui, x1: fieldX1, top: histoTop, bottom: histoBottom },
    strip: { x0: fieldX1, x1: stripX1 },
    corridor: { x0: stripX1, x1: corridorX1 },
    matrix: { x0: corridorX1, x1: W - right, top: histoTop, bottom: plotBottom },
  };
}

export type CardSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const COLS: { size: CardSize; frac: number; minH: number }[] = [
  { size: 'xs', frac: 0.125, minH: 40 },
  { size: 'sm', frac: 0.14, minH: 56 },
  { size: 'md', frac: 0.165, minH: 78 },
  { size: 'lg', frac: 0.2, minH: 110 },
  { size: 'xl', frac: 0.37, minH: 0 },
];

export interface CardSlot extends Rect {
  size: CardSize;
  col: number;
}

/** Slot capacity per column for a block of height h (column order: xs … xl). */
export function blockCapacity(h: number, ui: number): number[] {
  const gap = 4 * ui;
  return COLS.map((c) => {
    if (c.size === 'xl') return h > 300 * ui ? 3 : h > 160 * ui ? 2 : h > 60 * ui ? 1 : 0;
    return Math.max(0, Math.floor((h + gap) / (c.minH * ui + gap)));
  });
}

/** Decide how many cards each column gets (fill order xl → xs) for `available` instruments. */
export function planBlock(h: number, ui: number, available: number): number[] {
  const cap = blockCapacity(h, ui);
  const counts = new Array<number>(COLS.length).fill(0);
  let remaining = available;
  for (let ci = COLS.length - 1; ci >= 0 && remaining > 0; ci--) {
    counts[ci] = Math.min(cap[ci], remaining);
    remaining -= counts[ci];
  }
  return counts;
}

/**
 * Place cards for a block given per-column counts. Strongest movers get the largest cards
 * farthest from the corridor. Returns slots in fill order (xl first … xs last).
 */
export function placeBlock(x0: number, x1: number, top: number, bottom: number, ui: number, counts: number[]): CardSlot[] {
  const gap = 4 * ui;
  const h = Math.max(10, bottom - top);
  const totalW = x1 - x0 - gap * (COLS.length - 1);
  const xs: number[] = [];
  let x = x0;
  for (const c of COLS) {
    xs.push(x);
    x += c.frac * totalW + gap;
  }
  const slots: CardSlot[] = [];
  for (let ci = COLS.length - 1; ci >= 0; ci--) {
    const c = COLS[ci];
    const n = counts[ci];
    if (!n) continue;
    const w = c.frac * totalW;
    const fracs = c.size === 'xl' ? (n === 3 ? [0.46, 0.27, 0.27] : n === 2 ? [0.6, 0.4] : [1]) : new Array(n).fill(1 / n);
    const avail = h - gap * (n - 1);
    let y = top;
    for (let i = 0; i < n; i++) {
      const hh = Math.max(4, avail * fracs[i]);
      slots.push({ x: xs[ci], y, w, h: hh, size: c.size, col: ci });
      y += hh + gap;
    }
  }
  return slots;
}

export function totalCapacity(h: number, ui: number): number {
  return blockCapacity(h, ui).reduce((a, b) => a + b, 0);
}
