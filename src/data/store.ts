/** MarketStore: the single source of truth. Adapters feed it; React reads immutable snapshots. */
import type { MarketDataAdapter } from './adapter';
import type { FeedStatus, MarketSnapshot } from './types';
import { applyTick } from './bars';

const STALE_AFTER_MS = 6000;

export class MarketStore {
  private snap: MarketSnapshot | null = null;
  private listeners = new Set<() => void>();
  private unsub: (() => void) | null = null;
  private staleTimer: ReturnType<typeof setInterval> | null = null;
  private baseStatus: FeedStatus = 'connecting';
  private adapter: MarketDataAdapter;
  error: string | null = null;

  constructor(adapter: MarketDataAdapter) {
    this.adapter = adapter;
  }

  async start() {
    try {
      const init = await this.adapter.load();
      this.snap = {
        version: 1,
        source: this.adapter.source,
        status: 'connecting',
        asOf: init.asOf,
        receivedAt: Date.now(),
        session: init.session,
        instruments: init.instruments,
        series: init.series,
      };
      this.emit();
      this.unsub = this.adapter.subscribe({
        onTicks: (ticks) => {
          if (!this.snap) return;
          let asOf = this.snap.asOf;
          for (const t of ticks) {
            const s = this.snap.series[t.id];
            if (!s) continue;
            applyTick(s, t);
            if (t.ts > asOf) asOf = t.ts;
          }
          this.snap = { ...this.snap, version: this.snap.version + 1, asOf, receivedAt: Date.now(), status: this.baseStatus };
          this.emit();
        },
        onStatus: (status) => {
          this.baseStatus = status;
          if (!this.snap) return;
          this.snap = { ...this.snap, status, receivedAt: status === 'paused' ? this.snap.receivedAt : Date.now() };
          this.emit();
        },
      });
      this.staleTimer = setInterval(() => this.checkStale(), 1000);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.baseStatus = 'disconnected';
      this.emit();
    }
  }

  private checkStale() {
    if (!this.snap) return;
    const streaming = this.baseStatus === 'demo' || this.baseStatus === 'live' || this.baseStatus === 'delayed';
    const stale = streaming && Date.now() - this.snap.receivedAt > STALE_AFTER_MS;
    const next: FeedStatus = stale ? 'stale' : this.baseStatus;
    if (next !== this.snap.status) {
      this.snap = { ...this.snap, status: next };
      this.emit();
    }
  }

  setPaused(p: boolean) {
    this.adapter.setPaused?.(p);
  }

  stop() {
    this.unsub?.();
    if (this.staleTimer) clearInterval(this.staleTimer);
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snap;

  private emit() {
    for (const l of this.listeners) l();
  }
}
