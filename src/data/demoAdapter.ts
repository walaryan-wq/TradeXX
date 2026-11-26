/**
 * Deterministic simulated market. Produces a plausible, reproducible session for the demo
 * universe: prior-session history (15-min bars) plus today's 1-minute bars up to a start
 * time, then streams 15-simulated-second ticks every `intervalMs` of wall time.
 *
 * Model (transparent, not predictive): log-returns = market + sector + idiosyncratic
 * components, each a drift for the day plus smoothed (AR(1)) noise. Prices are rounded to
 * a 0.05 tick. Nothing here is a trading signal.
 */
import type { MarketDataAdapter, InitialLoad, StreamHandlers } from './adapter';
import type { Bar, Instrument, InstrumentSeries, SessionInfo, Tick } from './types';
import { buildDemoUniverse } from './universe';
import { gauss, hashString, mulberry32, type Rng } from './rng';
import { applyTick, MINUTE } from './bars';
import { volumeCurve } from './calc';

const IST_OFFSET_MIN = 330;
const SESSION_MIN = 375; // 09:15 → 15:30
const STEP_MS = 15_000; // simulated time per tick
const STEPS_PER_MIN = MINUTE / STEP_MS;
const SESSION_STEPS = SESSION_MIN * STEPS_PER_MIN;
const PRIOR_SESSIONS = 21;

export interface DemoOptions {
  seed?: number;
  /** Session date (YYYY-MM-DD) and start clock (HH:MM IST). */
  date?: string;
  start?: string;
  intervalMs?: number;
}

function istToUtc(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MIN * MINUTE;
}

/** White noise (sd `w`) + unit-variance AR(1) state, scaled so the sum over a full session has unit variance. */
function norm(g: number, w: number, ar: number, phi: number): number {
  return (w * g + ar) / Math.sqrt(SESSION_STEPS * (w * w + (1 + phi) / (1 - phi)));
}

const round05 = (p: number) => Math.max(0.05, Math.round(p * 20) / 20);

interface SimState {
  inst: Instrument;
  p: number; // latent price
  sigma: number; // daily volatility (fraction)
  beta: number;
  mu: number; // today's idiosyncratic drift (fraction over session)
  ar: number;
  volPerDay: number;
  volFactor: number; // today's relative-volume factor
}

export class DemoMarketAdapter implements MarketDataAdapter {
  readonly source = 'DEMO' as const;
  private rng: Rng;
  private opts: Required<DemoOptions>;
  private states: SimState[] = [];
  private sectorMu = new Map<string, number>();
  private sectorAr = new Map<string, number>();
  private marketMu = 0;
  private marketAr = 0;
  private step = 0;
  private session!: SessionInfo;
  private timer: ReturnType<typeof setInterval> | null = null;
  private paused = false;
  private handlers: StreamHandlers | null = null;

  constructor(opts: DemoOptions = {}) {
    this.opts = { seed: 42, date: '2026-10-29', start: '11:45', intervalMs: 1500, ...opts };
    this.rng = mulberry32(this.opts.seed);
  }

  async load(): Promise<InitialLoad> {
    const rng = this.rng;
    const instruments = buildDemoUniverse();
    const open = istToUtc(this.opts.date, '09:15');
    const close = open + SESSION_MIN * MINUTE;

    // Prior weekday sessions (holidays ignored in the demo calendar).
    const priorSessions: { open: number; close: number }[] = [];
    let d = new Date(open);
    while (priorSessions.length < PRIOR_SESSIONS) {
      d = new Date(d.getTime() - 24 * 3600_000);
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      priorSessions.unshift({ open: d.getTime(), close: d.getTime() + SESSION_MIN * MINUTE });
    }
    this.session = { open, close, priorSessions, timeZone: 'Asia/Kolkata' };

    // Day-level factors for today.
    this.marketMu = 0.0045 + gauss(rng) * 0.002;
    for (const s of new Set(instruments.map((i) => i.sector))) {
      this.sectorMu.set(s, gauss(rng) * 0.006);
      this.sectorAr.set(s, 0);
    }

    const series: Record<string, InstrumentSeries> = {};
    for (const inst of instruments) {
      const local = mulberry32(hashString(inst.symbol) ^ this.opts.seed);
      const base = Math.exp(Math.log(60) + local() * (Math.log(9000) - Math.log(60)));
      const tierVol = inst.tier === 'LARGE' ? 0.011 : inst.tier === 'MID' ? 0.016 : 0.022;
      const sigma = tierVol * (0.7 + local() * 0.7);
      const beta = 0.6 + local() * 0.8;
      const volPerDay = Math.round(Math.pow(10, (inst.tier === 'LARGE' ? 6.3 : inst.tier === 'MID' ? 5.7 : 5.2) + local() * 0.8));

      // Prior sessions: 25 × 15-minute bars each.
      const history: Bar[] = [];
      let p = base;
      for (const ps of priorSessions) {
        const dayRet = (gauss(rng) * 0.008 + 0.0004) * beta + gauss(rng) * sigma;
        const perBar = dayRet / 25;
        const barSig = sigma / 5;
        for (let b = 0; b < 25; b++) {
          const o = p;
          const r = perBar + gauss(rng) * barSig;
          const c = p * Math.exp(r);
          const h = Math.max(o, c) * (1 + Math.abs(gauss(rng)) * barSig * 0.4);
          const l = Math.min(o, c) * (1 - Math.abs(gauss(rng)) * barSig * 0.4);
          const v = Math.round((volPerDay / 25) * (volumeCurve(b * 15, SESSION_MIN) / 1.0) * Math.exp(gauss(rng) * 0.3));
          history.push({ t: ps.open + b * 15 * MINUTE, o: round05(o), h: round05(h), l: round05(l), c: round05(c), v });
          p = c;
        }
      }
      const prevClose = history[history.length - 1].c;
      const avgDayVolume = history.reduce((a, b) => a + b.v, 0) / PRIOR_SESSIONS;

      series[inst.id] = {
        id: inst.id,
        prevClose,
        history,
        today: [],
        last: prevClose,
        lastTs: 0,
        dayVolume: 0,
        avgDayVolume,
      };
      this.states.push({
        inst,
        p: prevClose * Math.exp(gauss(rng) * 0.004 + this.marketMu * 0.15),
        sigma,
        beta,
        mu: gauss(rng) * sigma * 0.55,
        ar: 0,
        volPerDay,
        volFactor: Math.exp(gauss(rng) * 0.35),
      });
    }

    // Run today's session from the open up to the requested start time.
    const startTs = Math.min(close, Math.max(open, istToUtc(this.opts.date, this.opts.start)));
    const targetStep = Math.round((startTs - open) / STEP_MS);
    while (this.step <= targetStep) {
      for (const t of this.advance()) applyTick(series[t.id], t);
    }
    const asOf = open + targetStep * STEP_MS;
    return { session: this.session, instruments, series, asOf };
  }

  /** Advance the simulation one 15-second step; returns ticks for every instrument. */
  private advance(): Tick[] {
    const rng = this.rng;
    const k = this.step++;
    const ts = this.session.open + k * STEP_MS;
    // Smoothed factor noise (AR(1)) gives the rise / dip / flatten character of intraday
    // paths. Each component is normalised so its whole-session standard deviation equals
    // the stated daily volatility.
    const phiF = 0.97;
    const phiI = 0.92;
    this.marketAr = phiF * this.marketAr + Math.sqrt(1 - phiF * phiF) * gauss(rng);
    for (const [s, v] of this.sectorAr) this.sectorAr.set(s, phiF * v + Math.sqrt(1 - phiF * phiF) * gauss(rng));
    const minute = Math.floor(k / STEPS_PER_MIN);
    const curve = volumeCurve(Math.min(minute, SESSION_MIN - 1), SESSION_MIN);

    const ticks: Tick[] = [];
    for (const st of this.states) {
      if (k > 0) {
        st.ar = phiI * st.ar + Math.sqrt(1 - phiI * phiI) * gauss(rng);
        const mkt = (this.marketMu / SESSION_STEPS + 0.0065 * norm(gauss(rng), 0.3, this.marketAr, phiF)) * st.beta;
        const sec = this.sectorMu.get(st.inst.sector)! / SESSION_STEPS + 0.0055 * norm(gauss(rng), 0.3, this.sectorAr.get(st.inst.sector)!, phiF);
        const idi = st.mu / SESSION_STEPS + st.sigma * 0.6 * norm(gauss(rng), 0.6, st.ar, phiI);
        st.p *= Math.exp(mkt + sec + idi);
      }
      const volume = Math.max(
        1,
        Math.round(((st.volPerDay * st.volFactor) / SESSION_STEPS) * (curve / 1.05) * Math.exp(gauss(rng) * 0.5)),
      );
      ticks.push({ id: st.inst.id, ts, price: round05(st.p), volume });
    }
    return ticks;
  }

  subscribe(handlers: StreamHandlers): () => void {
    this.handlers = handlers;
    handlers.onStatus(this.paused ? 'paused' : 'demo');
    this.timer = setInterval(() => {
      if (this.paused || !this.handlers) return;
      const nextTs = this.session.open + this.step * STEP_MS;
      if (nextTs > this.session.close) {
        this.handlers.onStatus('closed', 'Simulated session ended at 15:30 IST');
        if (this.timer) clearInterval(this.timer);
        return;
      }
      this.handlers.onTicks(this.advance());
    }, this.opts.intervalMs);
    return () => {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      this.handlers = null;
    };
  }

  setPaused(paused: boolean) {
    this.paused = paused;
    this.handlers?.onStatus(paused ? 'paused' : 'demo');
  }
}
