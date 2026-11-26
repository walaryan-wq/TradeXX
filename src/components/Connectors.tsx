/**
 * Bezier connectors from endpoint-strip rows (an instrument's rank) to its card.
 * Each path maps 1:1 to an instrument that has a card. Width is constant: it does NOT
 * encode capital or order flow.
 */
import type { Geom } from '../view/layout';
import type { YScale } from '../view/scale';
import type { ViewModel } from '../view/derive';
import type { PlacedCard } from './CardMatrix';
import { REVEAL } from '../view/theme';

interface Props {
  vm: ViewModel;
  scale: YScale;
  geom: Geom;
  cards: PlacedCard[];
  hotId: string | null;
  introDone: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export function Connectors({ vm, scale, geom, cards, hotId, introDone, onHover, onSelect }: Props) {
  const x0 = geom.strip.x1;
  const x1 = geom.matrix.x0 - 1;
  const cw = x1 - x0;
  const total = cards.length || 1;
  return (
    <svg className={`connectors${hotId ? ' has-hot' : ''}`} width={geom.W} height={geom.H}>
      {cards.map((c, i) => {
        const r = vm.byId.get(c.id);
        if (!r || r.rank < 0) return null;
        const y0 = scale.rowY(r.rank);
        const y1 = c.slot.y + c.slot.h / 2;
        const d = `M${x0},${y0.toFixed(1)} C${(x0 + cw * 0.55).toFixed(1)},${y0.toFixed(1)} ${(x1 - cw * 0.5).toFixed(1)},${y1.toFixed(1)} ${x1},${y1.toFixed(1)}`;
        const cls = `${(r.pct ?? 0) >= 0 ? 'pos' : 'neg'}${c.id === hotId ? ' hot' : ''} depth${c.slot.col}`;
        const delay = introDone ? 0 : REVEAL.conn[0] + (i / total) * 0.6;
        return (
          <g key={c.id} className={`conn ${cls}`} onMouseEnter={() => onHover(c.id)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(c.id)}>
            <path className="hit" d={d} style={{ d: `path("${d}")` } as React.CSSProperties} />
            <path className="ln" d={d} pathLength={1} style={{ d: `path("${d}")`, animationDelay: `${delay}s` } as React.CSSProperties} />
            <circle className="end" cx={x1} cy={y1} r={1.6 * geom.ui} style={{ animationDelay: `${delay + 0.9}s` }} />
          </g>
        );
      })}
    </svg>
  );
}
