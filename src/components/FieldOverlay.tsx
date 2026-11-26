/** Vector/HTML annotations over the canvas: axes, sector labels, histogram, counters, strip brackets. */
import type { Geom } from '../view/layout';
import type { ViewModel } from '../view/derive';
import { mapY, yTicks, type YScale } from '../view/scale';
import { fmtPct } from '../view/format';

interface Props {
  vm: ViewModel;
  scale: YScale;
  geom: Geom;
  posIds: string[];
  negIds: string[];
  sectorFilter: string;
  onSector: (s: string) => void;
}

export function FieldOverlay({ vm, scale, geom, posIds, negIds, sectorFilter, onSector }: Props) {
  const { plot, histo, strip, ui } = geom;
  const pw = plot.x1 - plot.x0;
  const ticks = yTicks(scale, 15 * ui);

  // Sector labels at their average-% height, de-overlapped.
  const LH = 25 * ui;
  const labels = vm.sectors.map((s) => ({ s, y: mapY(scale, s.avg) - LH / 2 }));
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y < labels[i - 1].y + LH) labels[i].y = labels[i - 1].y + LH;
  const maxY = plot.bottom - LH;
  if (labels.length && labels[labels.length - 1].y > maxY) {
    labels[labels.length - 1].y = maxY;
    for (let i = labels.length - 2; i >= 0; i--) if (labels[i].y > labels[i + 1].y - LH) labels[i].y = labels[i + 1].y - LH;
  }

  // Breadth histogram.
  const n = Math.max(1, vm.rows.length);
  const hMid = (histo.top + histo.bottom) / 2 + 6 * ui;
  const hAmp = (histo.bottom - histo.top) / 2 - 4 * ui;
  const bw = Math.max(1, ((histo.x1 - histo.x0) / Math.max(1, vm.breadth.length)) * 0.62);
  const lastX = vm.rows[0]?.xs[vm.rows[0].xs.length - 1] ?? 1;

  // Strip brackets: which rank ranges have cards.
  const bracket = (ids: string[]) => {
    const ranks = ids.map((id) => vm.byId.get(id)?.rank ?? -1).filter((r) => r >= 0);
    if (!ranks.length) return null;
    const a = Math.min(...ranks);
    const b = Math.max(...ranks);
    const half = n > 1 ? (scale.rowY(1) - scale.rowY(0)) / 2 : 3;
    return { y0: scale.rowY(a) - half, y1: scale.rowY(b) + half };
  };
  const bPos = bracket(posIds);
  const bNeg = bracket(negIds);
  const splitY = vm.adv < vm.rows.length ? scale.rowY(vm.adv) - (n > 1 ? (scale.rowY(1) - scale.rowY(0)) / 2 : 0) : scale.rowY(n - 1);
  const best = vm.sectors[0];
  const worst = vm.sectors[vm.sectors.length - 1];
  const axisLabel = `% CHG ${vm.refLabel.toUpperCase()}`;

  return (
    <div className="field-overlay">
      <svg className="overlay-svg" width={strip.x1 + 4} height={geom.H} aria-hidden>
        {/* breadth histogram */}
        <g className="reveal-grid">
          <line x1={histo.x0} x2={histo.x1} y1={hMid} y2={hMid} className="h-axis" />
          {vm.breadth.map((b, i) => {
            const h = (Math.abs(b.net) / n) * hAmp;
            const x = histo.x0 + b.x * lastX * (histo.x1 - histo.x0) - bw / 2;
            return b.net >= 0 ? (
              <rect key={i} x={x} y={hMid - h} width={bw} height={Math.max(0.5, h)} className="hb pos" />
            ) : (
              <rect key={i} x={x} y={hMid} width={bw} height={Math.max(0.5, h)} className="hb neg" />
            );
          })}
        </g>
        {/* y tick labels */}
        <g className="reveal-grid">
          {ticks.map((t) => (
            <text key={t.v} x={geom.axisX - 6 * ui} y={t.y} className="ytick" textAnchor="end" dominantBaseline="middle">
              {t.v > 0 ? `+${t.v}` : t.v}
            </text>
          ))}
          {vm.timeTicks.map((t) => (
            <text key={`${t.label}${t.x}`} x={plot.x0 + t.x * pw} y={plot.bottom + 14 * ui} className="xtick">
              {t.label}
            </text>
          ))}
          <text x={plot.x1 - 2} y={plot.bottom + 14 * ui} className="xtick now" textAnchor="end">
            {new Date(vm.asOf).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
          </text>
        </g>
        {/* strip brackets */}
        <g className="reveal-strip">
          {bPos && <Bracket x0={strip.x0} x1={strip.x1} y0={bPos.y0} y1={bPos.y1} cls="pos" />}
          {bNeg && <Bracket x0={strip.x0} x1={strip.x1} y0={bNeg.y0} y1={bNeg.y1} cls="neg" />}
          <line x1={strip.x0} x2={strip.x1} y1={splitY} y2={splitY} className="split-line" />
        </g>
      </svg>

      <div className="axis-caption reveal-grid" style={{ left: plot.x0 + 4, top: plot.top - 13 * ui }} title="Y axis is rank-scaled: each instrument's latest value sits on its rank row, so spacing between labels is non-linear. Values are percentage change from the period's reference price.">
        {axisLabel} · RANK-SCALED ⓘ
      </div>

      <div className="split-count reveal-strip" style={{ left: strip.x0 - 30 * ui, top: splitY - 7 * ui }} title={`${vm.rows.length} instruments with valid data in the current filter`}>
        {vm.rows.length}
      </div>

      <div className="sector-labels reveal-grid">
        {labels.map(({ s, y }) => (
          <button
            key={s.name}
            type="button"
            className={`sector-label${sectorFilter === s.name ? ' on' : ''}`}
            style={{ top: y, left: plot.x0 + 4 * ui }}
            onClick={() => onSector(sectorFilter === s.name ? 'ALL' : s.name)}
            title={`${s.name}: equal-weight average ${fmtPct(s.avg)} · ${s.adv} up / ${s.dec} down of ${s.n}. Click to ${sectorFilter === s.name ? 'clear' : 'filter'}.`}
          >
            <span className="nm">{s.name}</span>
            <span className={`v ${s.avg >= 0 ? 'pos' : 'neg'}`}>{fmtPct(s.avg)}</span>
            <span className="breadth">
              <i className="pos" style={{ flexGrow: s.adv }} />
              <i className="neg" style={{ flexGrow: s.dec }} />
              <i className="flat" style={{ flexGrow: s.n - s.adv - s.dec }} />
            </span>
          </button>
        ))}
      </div>

      <div className="counters reveal-grid" style={{ right: geom.W - strip.x1 + 2, top: histo.top + 2 }}>
        {best && (
          <div className="leaders">
            <span className="pos" title="Best sector (equal-weight average)">↗ {best.name} {fmtPct(best.avg)}</span>
            {worst && worst !== best && <span className="neg" title="Weakest sector (equal-weight average)">↘ {worst.name} {fmtPct(worst.avg)}</span>}
          </div>
        )}
        <div className="cnt" title={`Instruments above their period reference price (of ${vm.rows.length} with valid data${vm.unch ? `; ${vm.unch} unchanged` : ''}${vm.invalid.length ? `; ${vm.invalid.length} without valid data` : ''})`}>
          <label className="pos">▲ BULLISH</label>
          <b className="pos">{vm.adv}</b>
        </div>
        <div className="cnt" title="Instruments below their period reference price">
          <label className="neg">▼ BEARISH</label>
          <b className="neg">{vm.dec}</b>
        </div>
      </div>
      <div className="histo-caption reveal-grid" style={{ left: histo.x0, top: histo.top }} title="Net breadth over time: (# instruments above reference) − (# below), sampled across the period">
        NET BREADTH
      </div>
    </div>
  );
}

function Bracket({ x0, x1, y0, y1, cls }: { x0: number; x1: number; y0: number; y1: number; cls: string }) {
  const k = 5;
  return (
    <g className={`bracket ${cls}`}>
      <rect x={x0} y={y0} width={x1 - x0} height={Math.max(1, y1 - y0)} className="bracket-fill" />
      <path d={`M${x0},${y0 + k}V${y0}H${x0 + k} M${x1 - k},${y0}H${x1}V${y0 + k} M${x0},${y1 - k}V${y1}H${x0 + k} M${x1 - k},${y1}H${x1}V${y1 - k}`} />
    </g>
  );
}
