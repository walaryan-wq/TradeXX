/**
 * Rank-quantile y-scale. Each instrument's latest value lands on its own evenly spaced
 * row (its rank), so trajectory endpoints line up with the endpoint strip and the zero
 * line splits the field in proportion to advancers vs decliners. Values between endpoints
 * are interpolated linearly; values beyond the extreme endpoints use a small padded band.
 * The axis is therefore non-linear: tick labels show the real % values.
 */
export interface YScale {
  top: number;
  bottom: number;
  vals: Float64Array; // strictly decreasing
  ys: Float64Array; // increasing
  rowY: (rank: number) => number;
  n: number;
  pad: number;
}

export function buildScale(endpoints: number[], gMin: number, gMax: number, top: number, bottom: number): YScale {
  const n = endpoints.length;
  const h = bottom - top;
  const pad = Math.min(h * 0.07, 40);
  const rowY = (rank: number) => (n <= 0 ? (top + bottom) / 2 : top + pad + ((rank + 0.5) / n) * (h - 2 * pad));
  const spread = Math.max(1e-6, gMax - gMin);
  const minGap = spread * 0.0015;

  const vals: number[] = [];
  const ys: number[] = [];
  const hiV = Math.max(gMax, (endpoints[0] ?? 0) + spread * 0.01);
  vals.push(hiV);
  ys.push(top);
  // Merge near-tied endpoints into one knot at the mean of their row positions.
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && endpoints[i] - endpoints[j + 1] < minGap) j++;
    let v = 0;
    let y = 0;
    for (let k = i; k <= j; k++) {
      v += endpoints[k];
      y += rowY(k);
    }
    v /= j - i + 1;
    y /= j - i + 1;
    if (v < vals[vals.length - 1] - 1e-9) {
      vals.push(v);
      ys.push(y);
    }
    i = j + 1;
  }
  const loV = Math.min(gMin, (endpoints[n - 1] ?? 0) - spread * 0.01);
  if (loV < vals[vals.length - 1]) {
    vals.push(loV);
    ys.push(bottom);
  }
  return { top, bottom, vals: Float64Array.from(vals), ys: Float64Array.from(ys), rowY, n, pad };
}

export function mapY(s: YScale, v: number): number {
  const { vals, ys } = s;
  const m = vals.length;
  if (m === 1) return ys[0];
  if (v >= vals[0]) return ys[0];
  if (v <= vals[m - 1]) return ys[m - 1];
  // binary search: vals decreasing
  let lo = 0;
  let hi = m - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (vals[mid] >= v) lo = mid;
    else hi = mid;
  }
  const t = (vals[lo] - v) / (vals[lo] - vals[hi]);
  return ys[lo] + t * (ys[hi] - ys[lo]);
}

const TICK_CANDIDATES = [0, 1, -1, 2, -2, 0.5, -0.5, 3, -3, 5, -5, 10, -10, 0.25, -0.25, 1.5, -1.5, 0.75, -0.75, 7, -7, 15, -15, 20, -20, 0.1, -0.1, 1.25, -1.25];

export function yTicks(s: YScale, minSpacing: number): { v: number; y: number }[] {
  const out: { v: number; y: number }[] = [];
  const hi = s.vals[0];
  const lo = s.vals[s.vals.length - 1];
  for (const v of TICK_CANDIDATES) {
    if (v > hi || v < lo) continue;
    const y = mapY(s, v);
    if (out.every((t) => Math.abs(t.y - y) >= minSpacing)) out.push({ v, y });
  }
  return out.sort((a, b) => a.y - b.y);
}
