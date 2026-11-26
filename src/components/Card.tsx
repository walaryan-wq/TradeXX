import { memo, useEffect, useRef } from 'react';
import type { Row } from '../view/derive';
import type { CardSlot } from '../view/layout';
import { volumeProfile } from '../data/calc';
import { Spark } from './Spark';
import { fmtPct, fmtPrice, fmtVol } from '../view/format';

interface Props {
  row: Row;
  slot: CardSlot;
  ui: number;
  hot: boolean;
  dim: boolean;
  delay: number;
  version: number;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function Profile({ row, bins, className }: { row: Row; bins: number; className?: string }) {
  const prof = volumeProfile(row.series.today, bins);
  if (!prof) return null;
  const max = Math.max(...prof.vols) || 1;
  const lastBin = Math.min(bins - 1, Math.max(0, Math.floor(((row.last - prof.lo) / (prof.hi - prof.lo || 1)) * bins)));
  return (
    <div className={`profile ${className ?? ''}`} title="Simulated volume-at-price for today (from 1-min bars)">
      {prof.vols
        .map((v, i) => (
          <i key={i} className={i === lastBin ? 'at' : ''} style={{ width: `${Math.max(3, (v / max) * 100)}%` }} />
        ))
        .reverse()}
    </div>
  );
}

function CardImpl({ row, slot, ui, hot, dim, delay, onHover, onSelect }: Props) {
  // Short localized highlight when the last price changes. Uses a child overlay so the
  // card's own entry animation is never restarted.
  const flash = useRef<HTMLElement>(null);
  const lastSeen = useRef(row.last);
  useEffect(() => {
    const f = flash.current;
    if (row.last !== lastSeen.current && f) {
      f.classList.remove('up', 'down');
      void f.offsetWidth;
      f.classList.add(row.last > lastSeen.current ? 'up' : 'down');
    }
    lastSeen.current = row.last;
  }, [row.last]);

  const sign = row.pct == null ? 'flat' : row.pct > 0 ? 'pos' : row.pct < 0 ? 'neg' : 'flat';
  const { size } = slot;
  const pad = 5 * ui;
  const innerW = slot.w - pad * 2;
  const tag = row.relVol != null && row.relVol >= 1.3 ? `VOL ${row.relVol.toFixed(1)}×` : row.inst.tier === 'LARGE' ? 'LARGE CAP' : row.inst.tier === 'MID' ? 'MID CAP' : 'SMALL CAP';
  const title = `${row.inst.symbol} · ${row.inst.sector} · ${fmtPrice(row.last)} · ${fmtPct(row.pct)} ${'\n'}Click for detail`;

  return (
    <button
      type="button"
      className={`card card-${size} ${sign}${hot ? ' hot' : ''}${dim ? ' dim' : ''}`}
      style={{ left: slot.x, top: slot.y, width: slot.w, height: slot.h, animationDelay: `${delay}s` }}
      onMouseEnter={() => onHover(row.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(row.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(row.id)}
      title={title}
      aria-label={`${row.inst.symbol} ${fmtPrice(row.last)} ${fmtPct(row.pct)}`}
    >
      <i ref={flash} className="flash" aria-hidden />
      {size === 'xs' && (
        <>
          <Profile row={row} bins={10} className="bg" />
          <span className="sym">{row.inst.symbol}</span>
          <span className="pct">{fmtPct(row.pct)}</span>
        </>
      )}
      {size === 'sm' && (
        <>
          <Profile row={row} bins={12} className="bg" />
          <span className="sym">{row.inst.symbol}</span>
          <span className="pct">{fmtPct(row.pct)}</span>
          <div className="spark-wrap">
            <Spark row={row} w={innerW} h={Math.max(8, slot.h - 36 * ui)} />
          </div>
        </>
      )}
      {size === 'md' && (
        <>
          <Profile row={row} bins={14} className="bg" />
          <span className="sym">{row.inst.symbol}</span>
          <span className="pct">{fmtPct(row.pct)}</span>
          <span className="tag">{tag}</span>
          <div className="spark-wrap">
            <Spark row={row} w={innerW} h={Math.max(8, slot.h - 62 * ui)} />
          </div>
          <span className="px-chip">{fmtPrice(row.last)}</span>
        </>
      )}
      {size === 'lg' && (
        <>
          <div className="lg-left">
            <div className="head">
              <span className="logo">{row.inst.symbol[0]}</span>
              <span className="sym">{row.inst.symbol}</span>
            </div>
            <span className="pct">{fmtPct(row.pct)}</span>
            <span className="tag">{tag}</span>
            <div className="spark-wrap">
              <Spark row={row} w={innerW * 0.52} h={Math.max(8, slot.h - 82 * ui)} />
            </div>
          </div>
          <Profile row={row} bins={Math.max(10, Math.min(28, Math.round(slot.h / (4.2 * ui))))} className="side" />
          <span className="px-chip">{fmtPrice(row.last)}</span>
        </>
      )}
      {size === 'xl' && <XL row={row} slot={slot} ui={ui} />}
    </button>
  );
}

function XL({ row, slot, ui }: { row: Row; slot: CardSlot; ui: number }) {
  const big = slot.h > 150 * ui;
  const bull = (row.pct ?? 0) >= 0;
  const range = row.dayHigh != null && row.dayLow != null ? row.dayHigh - row.dayLow : 0;
  const pos = range > 0 ? (row.last - row.dayLow!) / range : 0.5;
  const chartW = slot.w * 0.46;
  const chartH = big ? slot.h * 0.42 : slot.h - 34 * ui;
  return (
    <div className={`xl ${big ? 'big' : 'compact'}`}>
      <div className="xl-head">
        <span className="logo">{row.inst.symbol[0]}</span>
        <div>
          <div className="sym">{row.inst.symbol}</div>
          <div className="sub">
            {row.inst.sector} · {row.inst.tier}
          </div>
        </div>
      </div>
      <div className="xl-badges">
        <span className={`badge ${bull ? 'bull' : 'bear'}`}>{bull ? 'BULLISH' : 'BEARISH'}</span>
        <span className="pctile" title="Percentile rank of period % change within the filtered universe">
          P{row.percentile}
        </span>
      </div>
      <div className="xl-pct">{fmtPct(row.pct)}</div>
      <div className="xl-px">
        {fmtPrice(row.last)} <span>{row.absChange == null ? '—' : `${row.absChange >= 0 ? '+' : ''}${row.absChange.toFixed(2)}`}</span>
      </div>
      <div className="xl-chart">
        <Spark row={row} w={chartW} h={Math.max(10, chartH)} fill />
      </div>
      {big && (
        <>
          <div className="xl-stats">
            <div>
              <label>DAY LOW</label>
              <b>{fmtPrice(row.dayLow)}</b>
            </div>
            <div>
              <label>VWAP</label>
              <b>{fmtPrice(row.vwap)}</b>
            </div>
            <div>
              <label>DAY HIGH</label>
              <b>{fmtPrice(row.dayHigh)}</b>
            </div>
            <div>
              <label>VOLUME</label>
              <b>{fmtVol(row.series.dayVolume)}</b>
            </div>
          </div>
          <div className="xl-range" title="Last price within today's low–high range">
            <i style={{ left: `${pos * 100}%` }} />
          </div>
        </>
      )}
    </div>
  );
}

export const Card = memo(CardImpl, (a, b) => a.version === b.version && a.slot === b.slot && a.hot === b.hot && a.dim === b.dim && a.ui === b.ui && a.delay === b.delay && a.row === b.row);
