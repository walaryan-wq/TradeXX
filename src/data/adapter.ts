/**
 * Market-data adapter contract. The UI talks only to this interface through MarketStore.
 *
 * To plug in an authorized provider, implement this interface (see README → "Replacing the
 * demo adapter"). Keep provider credentials on a server: a browser adapter should talk to
 * your own backend/WebSocket proxy, never embed API secrets.
 */
import type { Instrument, InstrumentSeries, FeedStatus, SessionInfo, Tick } from './types';

export interface InitialLoad {
  session: SessionInfo;
  instruments: Instrument[];
  series: Record<string, InstrumentSeries>;
  /** Timestamp of the most recent data point in the load. */
  asOf: number;
}

export interface StreamHandlers {
  onTicks(ticks: Tick[]): void;
  onStatus(status: FeedStatus, detail?: string): void;
}

export interface MarketDataAdapter {
  readonly source: 'DEMO' | 'LIVE';
  /** Universe + historical snapshot (prior sessions + today so far). */
  load(): Promise<InitialLoad>;
  /** Start streaming incremental ticks. Returns an unsubscribe function. */
  subscribe(handlers: StreamHandlers): () => void;
  /** Optional: pause/resume upstream delivery (demo can pause its clock). */
  setPaused?(paused: boolean): void;
}
