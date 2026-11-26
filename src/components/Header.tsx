import { forwardRef } from 'react';
import type { Filters } from '../view/derive';
import type { FeedStatus, Period } from '../data/types';
import { SECTOR_NAMES } from '../data/universe';
import { IconSearch } from './icons';

interface Props {
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  universeCount: number;
  shownCount: number;
  status: FeedStatus;
  asOf: number | null;
  mobileView: 'field' | 'board' | null;
  onMobileView: (v: 'field' | 'board') => void;
}

const STATUS_TEXT: Record<FeedStatus, string> = {
  connecting: 'LOADING',
  demo: 'SIMULATED STREAM',
  live: 'LIVE',
  delayed: 'DELAYED',
  stale: 'STALE · NO UPDATES',
  paused: 'PAUSED',
  closed: 'SESSION CLOSED',
  disconnected: 'DISCONNECTED',
};

export const Header = forwardRef<HTMLInputElement, Props>(function Header(
  { filters, setFilters, universeCount, shownCount, status, asOf, mobileView, onMobileView },
  searchRef,
) {
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  const clock = asOf
    ? new Date(asOf).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata', hour12: false }).toUpperCase()
    : '—';
  return (
    <header className="topbar">
      <div className="brand" title="TradeXX market breadth monitor (reconstruction)">
        <span className="mark" aria-hidden>
          <i /><i /><i />
        </span>
        TRADEXX
      </div>
      <label className="search">
        <IconSearch />
        <input
          ref={searchRef}
          value={filters.query}
          onChange={(e) => setFilters({ query: e.target.value })}
          placeholder={`Search ${universeCount} stocks`}
          aria-label="Search by symbol or sector"
          spellCheck={false}
        />
        {filters.query ? (
          <button type="button" className="clear" onClick={() => setFilters({ query: '' })} aria-label="Clear search">×</button>
        ) : (
          <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
        )}
      </label>
      <select className="sel" value={filters.tier} onChange={(e) => setFilters({ tier: e.target.value as Filters['tier'] })} aria-label="Universe" title="Tracked universe (demo tiering)">
        <option value="ALL">All caps</option>
        <option value="LARGE">Large cap</option>
        <option value="MID">Mid cap</option>
        <option value="SMALL">Small cap</option>
      </select>
      <select className="sel" value={filters.sector} onChange={(e) => setFilters({ sector: e.target.value })} aria-label="Sector">
        <option value="ALL">All sectors</option>
        {SECTOR_NAMES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div className="seg" role="radiogroup" aria-label="Period">
        {(['1D', '5D', '1M'] as Period[]).map((p) => (
          <button key={p} type="button" role="radio" aria-checked={filters.period === p} className={filters.period === p ? 'on' : ''} onClick={() => setFilters({ period: p })}>
            {p}
          </button>
        ))}
      </div>
      <span className="shown" title="Instruments matching the current filters">
        {shownCount}/{universeCount}
      </span>
      {mobileView && (
        <div className="seg mobile-only" role="radiogroup" aria-label="View">
          <button type="button" className={mobileView === 'field' ? 'on' : ''} onClick={() => onMobileView('field')}>Field</button>
          <button type="button" className={mobileView === 'board' ? 'on' : ''} onClick={() => onMobileView('board')}>Board</button>
        </div>
      )}
      <div className="spacer" />
      <div className={`status st-${status}`} role="status" title="All prices, volumes and timestamps are simulated by the seeded demo adapter. No market connection.">
        <span className="demo">DEMO DATA</span>
        <span className="dot" />
        {STATUS_TEXT[status]}
      </div>
      <div className="clock" title="Simulated exchange time (IST)">{clock} IST</div>
    </header>
  );
});
