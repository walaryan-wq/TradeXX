import type { Row } from '../view/derive';

/** Tiny SVG sparkline of the row's period trajectory (same data as the main chart). */
export function Spark({ row, w, h, zero = true, fill = false }: { row: Row; w: number; h: number; zero?: boolean; fill?: boolean }) {
  const { xs, ys } = row;
  if (xs.length < 2 || w <= 0 || h <= 0) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < ys.length; i++) {
    lo = Math.min(lo, ys[i]);
    hi = Math.max(hi, ys[i]);
  }
  if (zero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  const span = hi - lo || 1;
  const x1 = xs[xs.length - 1] || 1;
  const step = Math.max(1, Math.floor(xs.length / Math.max(16, w / 2)));
  let d = '';
  for (let i = 0; i < xs.length; i += step) d += `${d ? 'L' : 'M'}${((xs[i] / x1) * w).toFixed(1)},${(((hi - ys[i]) / span) * h).toFixed(1)}`;
  const lx = w;
  const ly = ((hi - ys[ys.length - 1]) / span) * h;
  d += `L${lx.toFixed(1)},${ly.toFixed(1)}`;
  const zy = ((hi - 0) / span) * h;
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {zero && <line x1={0} x2={w} y1={zy} y2={zy} className="spark-zero" />}
      {fill && <path d={`${d}L${w},${zy}L0,${zy}Z`} className="spark-fill" />}
      <path d={d} className="spark-line" />
      <circle cx={lx} cy={ly} r={1.6} className="spark-dot" />
    </svg>
  );
}
