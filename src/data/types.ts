/** Core market-data types. Shared by adapters, the store, and view derivation. */

export type Tier = 'LARGE' | 'MID' | 'SMALL';

export interface Instrument {
  /** Stable identifier. Never reused, never derived from list position. */
  id: string;
  symbol: string;
  sector: string;
  tier: Tier;
}

/** OHLCV bar. `t` = bar start, epoch ms (UTC). */
export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface InstrumentSeries {
  id: string;
  /** Previous session close: reference price for the 1D period. */
  prevClose: number;
  /** Prior sessions, oldest first, 15-minute bars. */
  history: Bar[];
  /** Current session, 1-minute bars. The last bar may be in progress. */
  today: Bar[];
  last: number;
  /** Exchange/simulated timestamp of `last`, epoch ms. */
  lastTs: number;
  dayVolume: number;
  /** Average full-session volume over prior sessions (for relative volume). */
  avgDayVolume: number;
}

export type FeedStatus =
  | 'connecting'
  | 'demo' // simulated stream running
  | 'live'
  | 'delayed'
  | 'stale'
  | 'paused'
  | 'closed'
  | 'disconnected';

export interface Tick {
  id: string;
  ts: number;
  price: number;
  /** Incremental traded volume since the previous tick. */
  volume: number;
}

export interface SessionInfo {
  /** Epoch ms of today's session open / close. */
  open: number;
  close: number;
  /** Bar start times (epoch ms) of prior sessions' 15-min bars, oldest first, grouped by session. */
  priorSessions: { open: number; close: number }[];
  timeZone: string;
}

export interface MarketSnapshot {
  version: number;
  source: 'DEMO' | 'LIVE';
  status: FeedStatus;
  /** Latest data timestamp across the universe (epoch ms). */
  asOf: number;
  /** Wall-clock time the last tick batch arrived (ms). */
  receivedAt: number;
  session: SessionInfo;
  instruments: Instrument[];
  series: Record<string, InstrumentSeries>;
}

export type Period = '1D' | '5D' | '1M';
