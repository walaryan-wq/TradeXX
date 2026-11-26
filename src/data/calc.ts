/** Pure financial calculations. No rendering or I/O here. */
import type { Bar } from './types';

/**
 * percentageChange = 100 × (last − reference) / reference
 * Returns null for missing / non-finite / non-positive inputs instead of inventing a value.
 */
export function percentChange(last: number | null | undefined, reference: number | null | undefined): number | null {
  if (last == null || reference == null) return null;
  if (!Number.isFinite(last) || !Number.isFinite(reference)) return null;
  if (reference <= 0) return null;
  return (100 * (last - reference)) / reference;
}

/** Volume-weighted average price from bars, using typical price (h+l+c)/3. */
export function vwap(bars: Bar[]): number | null {
  let pv = 0;
  let v = 0;
  for (const b of bars) {
    pv += ((b.h + b.l + b.c) / 3) * b.v;
    v += b.v;
  }
  return v > 0 ? pv / v : null;
}

export function dayRange(bars: Bar[]): { high: number; low: number } | null {
  if (!bars.length) return null;
  let high = -Infinity;
  let low = Infinity;
  for (const b of bars) {
    if (b.h > high) high = b.h;
    if (b.l < low) low = b.l;
  }
  return { high, low };
}

/**
 * Volume-at-price profile: each bar's volume is spread evenly across the bins its
 * high–low range covers. Computed only from the bars supplied (simulated in demo mode).
 */
export function volumeProfile(bars: Bar[], bins: number): { lo: number; hi: number; vols: number[] } | null {
  const r = dayRange(bars);
  if (!r) return null;
  const lo = r.low;
  const hi = r.high > r.low ? r.high : r.low + 1e-9;
  const vols = new Array<number>(bins).fill(0);
  const w = (hi - lo) / bins;
  for (const b of bars) {
    const a = Math.max(0, Math.min(bins - 1, Math.floor((b.l - lo) / w)));
    const z = Math.max(0, Math.min(bins - 1, Math.floor((b.h - lo) / w)));
    const share = b.v / (z - a + 1);
    for (let i = a; i <= z; i++) vols[i] += share;
  }
  return { lo, hi, vols };
}

/** Typical intraday U-shaped volume curve weight for minute m of an n-minute session. */
export function volumeCurve(m: number, n: number): number {
  const x = m / n;
  return 0.55 + 2.2 * Math.pow(1 - x, 6) + 1.1 * Math.pow(x, 5);
}

/** Expected fraction of a full day's volume traded by minute m. */
export function expectedVolumeFraction(m: number, n: number): number {
  let tot = 0;
  let part = 0;
  for (let i = 0; i < n; i++) {
    const w = volumeCurve(i, n);
    tot += w;
    if (i < m) part += w;
  }
  return tot > 0 ? part / tot : 0;
}
