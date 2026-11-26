/**
 * View-model derivation: filtering, period reference prices, percentage changes, ranks,
 * sector stats and breadth. Everything visible (chart, strip, connectors, cards, counters,
 * drawer) reads from the one ViewModel built here, so values cannot drift apart.
 */
import { dayRange, expectedVolumeFraction, percentChange, vwap } from '../data/calc';
import { MINUTE } from '../data/bars';
import type { Bar, Instrument, InstrumentSeries, MarketSnapshot, Period, Tier } from '../data/types';

export interface Filters {
  query: string;
  sector: string; // 'ALL' or sector name
  tier: 'ALL' | Tier;
  period: Period;
}

export interface Row {
  id: string;
  inst: Instrument;
  series: InstrumentSeries;
  ref: number | null;
  last: number;
  lastTs: number;
  pct: number | null;
  absChange: number | null;
  /** Trajectory: x in [0,1] of the period's trading-time axis, y = % change from ref. */
  xs: Float32Array;
  ys: Float32Array;
  rank: number; // 0 = strongest; -1 when pct is invalid
  percentile: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  vwap: number | null;
  relVol: number | null;
}

export interface SectorStat {
  name: string;
  avg: number;
  adv: number;
  dec: number;
  n: number;
}

export interface TimeTick {
  x: number;
  label: string;
  major?: boolean;
}

export interface ViewModel {
  period: Period;
  universeCount: number;
  rows: Row[]; // valid rows sorted by pct desc
  invalid: Row[]; // filtered rows with no valid reference/last
  adv: number;
  dec: number;
  unch: number;
  sectors: SectorStat[];
  timeTicks: TimeTick[];
  breadth: { x: number; net: number }[];
  gMin: number;
  gMax: number;
  asOf: number;
  refLabel: string;
  byId: Map<string, Row>;
}

const SESSION_MIN = 375;
const fmtTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', hour12: false });
const fmtDay = (ts: number) =>
  new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }).toUpperCase();

export function matchesFilters(inst: Instrument, f: Filters): boolean {
  if (f.sector !== 'ALL' && inst.sector !== f.sector) return false;
  if (f.tier !== 'ALL' && inst.tier !== f.tier) return false;
  const q = f.query.trim().toUpperCase();
  if (q && !inst.symbol.includes(q) && !inst.sector.includes(q)) return false;
  return true;
}

interface PeriodPlan {
  priorCount: number; // prior sessions included in the window
  priorStride: number; // keep every Nth 15-min bar
  todayStride: number; // keep every Nth 1-min bar
}
const PLANS: Record<Period, PeriodPlan> = {
  '1D': { priorCount: 0, priorStride: 1, todayStride: 1 },
  '5D': { priorCount: 4, priorStride: 1, todayStride: 15 },
  '1M': { priorCount: 20, priorStride: 4, todayStride: 60 },
};

export function derive(snap: MarketSnapshot, f: Filters): ViewModel {
  const { session } = snap;
  const plan = PLANS[f.period];
  const elapsedMin = Math.max(1, Math.min(SESSION_MIN, (snap.asOf - session.open) / MINUTE));
  const totalMin = plan.priorCount * SESSION_MIN + Math.max(elapsedMin, f.period === '1D' ? 15 : 1);
  const priorStartIdx = session.priorSessions.length - plan.priorCount;
  const priorSessions = session.priorSessions.slice(priorStartIdx);

  const all: Row[] = [];
  let gMin = Infinity;
  let gMax = -Infinity;

  for (const inst of snap.instruments) {
    if (!matchesFilters(inst, f)) continue;
    const s = snap.series[inst.id];
    if (!s) continue;

    // Reference price for the period.
    let ref: number | null;
    if (f.period === '1D') ref = s.prevClose;
    else {
      const refSessionIdx = priorStartIdx - 1; // close of the session before the window
      const b = s.history[(refSessionIdx + 1) * 25 - 1];
      ref = b ? b.c : null;
    }

    const last = s.today.length ? s.last : NaN;
    const pct = percentChange(Number.isFinite(last) ? last : null, ref);

    // Trajectory points on a trading-time axis.
    const px: number[] = [];
    const py: number[] = [];
    if (ref && ref > 0) {
      priorSessions.forEach((_ps, si) => {
        const bars = s.history.slice((priorStartIdx + si) * 25, (priorStartIdx + si + 1) * 25);
        bars.forEach((b, bi) => {
          if (bi % plan.priorStride !== plan.priorStride - 1 && bi !== bars.length - 1) return;
          px.push((si * SESSION_MIN + (bi + 1) * 15) / totalMin);
          py.push((100 * (b.c - ref!)) / ref!);
        });
      });
      const base = plan.priorCount * SESSION_MIN;
      if (s.today.length) {
        if (f.period === '1D') {
          px.push(0);
          py.push((100 * (s.today[0].o - ref)) / ref);
        }
        s.today.forEach((b: Bar, bi) => {
          const isLast = bi === s.today.length - 1;
          if (!isLast && bi % plan.todayStride !== plan.todayStride - 1) return;
          const endMin = isLast ? (s.lastTs - session.open) / MINUTE : (b.t + MINUTE - session.open) / MINUTE;
          px.push((base + Math.min(endMin, elapsedMin)) / totalMin);
          py.push((100 * (b.c - ref)) / ref);
        });
      }
    }
    const xs = Float32Array.from(px);
    const ys = Float32Array.from(py);
    for (let i = 0; i < ys.length; i++) {
      if (ys[i] < gMin) gMin = ys[i];
      if (ys[i] > gMax) gMax = ys[i];
    }

    const range = dayRange(s.today);
    const expected = s.avgDayVolume * expectedVolumeFraction(elapsedMin, SESSION_MIN);
    all.push({
      id: inst.id,
      inst,
      series: s,
      ref,
      last,
      lastTs: s.lastTs,
      pct,
      absChange: pct == null || ref == null ? null : last - ref,
      xs,
      ys,
      rank: -1,
      percentile: null,
      dayHigh: range?.high ?? null,
      dayLow: range?.low ?? null,
      vwap: vwap(s.today),
      relVol: expected > 0 ? s.dayVolume / expected : null,
    });
  }

  const rows = all.filter((r) => r.pct != null).sort((a, b) => b.pct! - a.pct! || a.inst.symbol.localeCompare(b.inst.symbol));
  const invalid = all.filter((r) => r.pct == null);
  rows.forEach((r, i) => {
    r.rank = i;
    r.percentile = rows.length > 1 ? Math.round(100 * (1 - i / (rows.length - 1))) : 100;
  });

  let adv = 0;
  let dec = 0;
  let unch = 0;
  const sectorMap = new Map<string, SectorStat>();
  for (const r of rows) {
    if (r.pct! > 0) adv++;
    else if (r.pct! < 0) dec++;
    else unch++;
    const st = sectorMap.get(r.inst.sector) ?? { name: r.inst.sector, avg: 0, adv: 0, dec: 0, n: 0 };
    st.avg += r.pct!;
    st.n++;
    if (r.pct! > 0) st.adv++;
    else if (r.pct! < 0) st.dec++;
    sectorMap.set(r.inst.sector, st);
  }
  const sectors = [...sectorMap.values()].map((s) => ({ ...s, avg: s.avg / s.n })).sort((a, b) => b.avg - a.avg);

  // Time ticks.
  const timeTicks: TimeTick[] = [];
  if (f.period === '1D') {
    for (let m = 45; m < elapsedMin - 12; m += 30) {
      timeTicks.push({ x: m / totalMin, label: fmtTime(session.open + m * MINUTE), major: m % 60 === 45 });
    }
    timeTicks.unshift({ x: 0, label: fmtTime(session.open), major: true });
  } else {
    priorSessions.forEach((ps, si) => {
      if (f.period === '1M' && si % 4 !== 0) return;
      timeTicks.push({ x: (si * SESSION_MIN) / totalMin, label: fmtDay(ps.open), major: true });
    });
    timeTicks.push({ x: (plan.priorCount * SESSION_MIN) / totalMin, label: fmtDay(session.open), major: true });
  }

  // Net breadth over time: (# above ref) − (# below ref) at evenly spaced x samples.
  const B = f.period === '1D' ? Math.max(8, Math.round(elapsedMin / 3)) : 120;
  const net = new Array<number>(B).fill(0);
  for (const r of rows) {
    let j = 0;
    for (let b = 0; b < B; b++) {
      const x = (b + 1) / B * (r.xs[r.xs.length - 1] ?? 1);
      while (j < r.xs.length - 1 && r.xs[j + 1] <= x) j++;
      const v = r.ys[j];
      if (v > 0) net[b]++;
      else if (v < 0) net[b]--;
    }
  }
  const breadth = net.map((n, b) => ({ x: (b + 0.5) / B, net: n }));

  const asOf = snap.asOf;
  const refLabel =
    f.period === '1D'
      ? 'vs previous close'
      : `vs close of ${fmtDay(session.priorSessions[priorStartIdx - 1]?.open ?? session.open)}`;

  if (!Number.isFinite(gMin)) {
    gMin = -1;
    gMax = 1;
  }
  return {
    period: f.period,
    universeCount: snap.instruments.length,
    rows,
    invalid,
    adv,
    dec,
    unch,
    sectors,
    timeTicks,
    breadth,
    gMin,
    gMax,
    asOf,
    refLabel,
    byId: new Map(all.map((r) => [r.id, r])),
  };
}

export { fmtTime, fmtDay };
