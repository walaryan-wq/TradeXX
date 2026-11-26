/** Detail drawer for one instrument. Reads the SAME Row as the card, so last values always agree. */
import { useMemo } from 'react';
import type { Row, ViewModel } from '../view/derive';
import { fmtPct, fmtPrice, fmtVol } from '../view/format';
import { volumeProfile } from '../data/calc';

interface Props {
  row: Row | null;
  vm: ViewModel;
  onClose: () => void;
}

export function DetailDrawer({ row, vm, onClose }: Props) {
  const open = !!row;
  return (
    <aside className={`drawer detail${open ? ' open' : ''}`} aria-hidden={!open} aria-label="Instrument detail">
      {row && <DetailBody row={row} vm={vm} onClose={onClose} />}
    </aside>
  );
}

function DetailBody({ row, vm, onClose }: { row: Row; vm: ViewModel; onClose: () => void }) {
  const W = 440;
  const H = 220;
  const { xs, ys } = row;
  const sign = (row.pct ?? 0) >= 0 ? 'pos' : 'neg';
  const chart = useMemo(() => {
    if (xs.length < 2) return null;
    let lo = 0;
    let hi = 0;
    for (const v of ys) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const vwPct = vm.period === '1D' && row.vwap != null && row.ref ? (100 * (row.vwap - row.ref)) / row.ref : null;
    if (vwPct != null) {
      lo = Math.min(lo, vwPct);
      hi = Math.max(hi, vwPct);
    }
    const padv = (hi - lo) * 0.08 || 0.5;
    lo -= padv;
    hi += padv;
    const x1 = xs[xs.length - 1] || 1;
    const X = (x: number) => (x / x1) * W;
    const Y = (v: number) => ((hi - v) / (hi - lo)) * H;
    let d = '';
    for (let i = 0; i < xs.length; i++) d += `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(ys[i]).toFixed(1)}`;
    const grid: number[] = [];
    const step = niceStep((hi - lo) / 5);
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) grid.push(+v.toFixed(6));
    return { d, X, Y, grid, vwPct, lastY: Y(ys[ys.length - 1]) };
  }, [xs, ys, row.vwap, row.ref, vm.period]);

  const bars = row.series.today;
  const vmax = Math.max(1, ...bars.map((b) => b.v));
  const prof = volumeProfile(bars, 24);
  const pmax = prof ? Math.max(...prof.vols) : 1;

  return (
    <div className="detail-body">
      <div className="d-head">
        <span className={`logo ${sign}`}>{row.inst.symbol[0]}</span>
        <div>
          <h2>{row.inst.symbol}</h2>
          <div className="sub">
            {row.inst.sector} · {row.inst.tier} CAP · {row.id}
          </div>
        </div>
        <button type="button" className="x" onClick={onClose} aria-label="Close detail">×</button>
      </div>
      <div className="d-price">
        <b>{fmtPrice(row.last)}</b>
        <span className={sign}>{fmtPct(row.pct)}</span>
        <span className={`abs ${sign}`}>{row.absChange == null ? '—' : `${row.absChange >= 0 ? '+' : ''}${row.absChange.toFixed(2)}`}</span>
      </div>
      <div className="d-meta">
        {vm.period} · {vm.refLabel} · ref {fmtPrice(row.ref)} · as of{' '}
        {new Date(row.lastTs).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false })} IST (simulated)
      </div>

      {chart && (
        <svg className={`d-chart ${sign}`} viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" role="img" aria-label={`${row.inst.symbol} % change over ${vm.period}`}>
          {chart.grid.map((v) => (
            <g key={v}>
              <line x1={0} x2={W} y1={chart.Y(v)} y2={chart.Y(v)} className={v === 0 ? 'zero' : 'g'} />
              <text x={W - 2} y={chart.Y(v) - 2} textAnchor="end">{v > 0 ? `+${v}` : v}%</text>
            </g>
          ))}
          {chart.vwPct != null && <line x1={0} x2={W} y1={chart.Y(chart.vwPct)} y2={chart.Y(chart.vwPct)} className="vwap" />}
          <path d={`${chart.d}L${W},${chart.Y(0)}L0,${chart.Y(0)}Z`} className="fill" />
          <path d={chart.d} className="ln" />
          <circle cx={W} cy={chart.lastY} r={3} className="dot" />
        </svg>
      )}
      <div className="d-legend">
        <span><i className={`sw ${sign}`} /> % change from reference</span>
        {vm.period === '1D' && <span><i className="sw vw" /> VWAP</span>}
        <span><i className="sw zero" /> reference ({fmtPrice(row.ref)})</span>
      </div>

      <div className="d-vol" title="Today's 1-minute volume (simulated)">
        {bars.map((b, i) => (
          <i key={i} style={{ height: `${(b.v / vmax) * 100}%` }} className={b.c >= b.o ? 'pos' : 'neg'} />
        ))}
      </div>
      <div className="d-cap">Today · 1-min volume (simulated)</div>

      <div className="d-grid">
        <Stat k="Last" v={fmtPrice(row.last)} />
        <Stat k={`Change (${vm.period})`} v={fmtPct(row.pct)} />
        <Stat k="Reference" v={fmtPrice(row.ref)} />
        <Stat k="Prev close" v={fmtPrice(row.series.prevClose)} />
        <Stat k="Day high" v={fmtPrice(row.dayHigh)} />
        <Stat k="Day low" v={fmtPrice(row.dayLow)} />
        <Stat k="VWAP (today)" v={fmtPrice(row.vwap)} />
        <Stat k="Volume (today)" v={fmtVol(row.series.dayVolume)} />
        <Stat k="Rel. volume" v={row.relVol == null ? '—' : `${row.relVol.toFixed(2)}×`} title="Today's volume ÷ expected volume by this time (avg of prior sessions × typical intraday curve)" />
        <Stat k="Rank" v={`${row.rank + 1} / ${vm.rows.length}`} title="Rank by period % change within the filtered universe" />
      </div>

      {prof && (
        <>
          <div className="d-cap">Volume at price · today (simulated, from 1-min bars)</div>
          <div className="d-profile">
            {prof.vols
              .map((v, i) => {
                const lo = prof.lo + ((prof.hi - prof.lo) * i) / prof.vols.length;
                const at = row.last >= lo && row.last < lo + (prof.hi - prof.lo) / prof.vols.length + 1e-9;
                return (
                  <div key={i} className={`pr${at ? ' at' : ''}`}>
                    <span>{fmtPrice(lo)}</span>
                    <i style={{ width: `${(v / pmax) * 100}%` }} />
                  </div>
                );
              })
              .reverse()}
          </div>
        </>
      )}
      <p className="d-note">Demo data from a seeded simulator. Not a quote, not a signal. Same values as the board card and chart endpoint.</p>
    </div>
  );
}

function Stat({ k, v, title }: { k: string; v: string; title?: string }) {
  return (
    <div className="stat" title={title}>
      <label>{k}</label>
      <b>{v}</b>
    </div>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
