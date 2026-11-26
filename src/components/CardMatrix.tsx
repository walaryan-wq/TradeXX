import type { CardSlot, Geom } from '../view/layout';
import type { ViewModel } from '../view/derive';
import { Card } from './Card';
import { REVEAL } from '../view/theme';

export interface PlacedCard {
  id: string;
  slot: CardSlot;
  block: 'pos' | 'neg';
}

interface Props {
  vm: ViewModel;
  geom: Geom;
  cards: PlacedCard[];
  hotId: string | null;
  splitY: number;
  introDone: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export function CardMatrix({ vm, geom, cards, hotId, splitY, introDone, onHover, onSelect }: Props) {
  const total = cards.length || 1;
  // Stagger: columns nearest the corridor first, then outward.
  const order = [...cards].sort((a, b) => a.slot.col - b.slot.col || a.slot.y - b.slot.y);
  const delayOf = new Map(order.map((c, i) => [c.id, REVEAL.cards[0] + (i / total) * (REVEAL.cards[1] - REVEAL.cards[0] - 0.5)]));
  const shownOf = vm.rows.length;
  return (
    <div className={`matrix${hotId ? ' has-hot' : ''}`} role="list" aria-label="Stock cards">
      <div
        className="matrix-divider reveal-strip"
        style={{ left: geom.matrix.x0, width: geom.matrix.x1 - geom.matrix.x0, top: splitY - 1 }}
        title={`Cards show the strongest and weakest movers: ${cards.length} of ${shownOf} filtered instruments. Ranking refreshes periodically to keep the board stable.`}
      />
      {cards.map((c) => {
        const row = vm.byId.get(c.id);
        if (!row) return null;
        return (
          <Card
            key={c.id}
            row={row}
            slot={c.slot}
            ui={geom.ui}
            hot={c.id === hotId}
            dim={!!hotId && c.id !== hotId}
            delay={introDone ? 0 : delayOf.get(c.id) ?? 0}
            version={0}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
