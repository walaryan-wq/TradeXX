/** Tick → bar aggregation. The single place where series are mutated from ticks. */
import type { Bar, InstrumentSeries, Tick } from './types';

export const MINUTE = 60_000;

export function applyTick(s: InstrumentSeries, tick: Tick): void {
  if (!Number.isFinite(tick.price) || tick.price <= 0) return; // reject invalid prints
  if (tick.ts < s.lastTs) return; // ignore out-of-order prints
  const t = Math.floor(tick.ts / MINUTE) * MINUTE;
  const lastBar: Bar | undefined = s.today[s.today.length - 1];
  if (lastBar && lastBar.t === t) {
    lastBar.c = tick.price;
    if (tick.price > lastBar.h) lastBar.h = tick.price;
    if (tick.price < lastBar.l) lastBar.l = tick.price;
    lastBar.v += tick.volume;
  } else {
    s.today.push({ t, o: tick.price, h: tick.price, l: tick.price, c: tick.price, v: tick.volume });
  }
  s.last = tick.price;
  s.lastTs = tick.ts;
  s.dayVolume += tick.volume;
}
