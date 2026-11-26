import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MarketStore } from './data/store';
import { DemoMarketAdapter } from './data/demoAdapter';
import { derive, type Filters, type ViewModel } from './view/derive';
import { buildScale, type YScale } from './view/scale';
import { computeGeom, placeBlock, planBlock, type Geom } from './view/layout';
import { FieldCanvas } from './components/FieldCanvas';
import { FieldOverlay } from './components/FieldOverlay';
import { Connectors } from './components/Connectors';
import { CardMatrix, type PlacedCard } from './components/CardMatrix';
import { Header } from './components/Header';
import { Rail } from './components/Rail';
import { DetailDrawer } from './components/DetailDrawer';
import { SettingsDrawer, type Settings } from './components/SettingsDrawer';
import { fmtPct, fmtPrice } from './view/format';

// ── Data source (swap DemoMarketAdapter for a real adapter; see README) ──────────────
const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed')) || 42;
const START = /^\d{2}:\d{2}$/.test(params.get('start') ?? '') ? params.get('start')! : '11:45';
const INTRO_OFF = params.get('intro') === '0';
const store = new MarketStore(new DemoMarketAdapter({ seed: SEED, start: START }));
void store.start();

const GUIDES: Record<Filters['period'], number[]> = {
  '1D': [1, 0.5, -0.5, -1.25],
  '5D': [3, 1, -1, -3],
  '1M': [5, 2, -2, -5],
};

interface Assignment {
  pos: string[];
  neg: string[];
  posCounts: number[];
  negCounts: number[];
  posH: number;
  negH: number;
}

function usePrefersReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    const h = () => setR(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, []);
  return r;
}

function splitYOf(vm: ViewModel, scale: YScale, geom: Geom) {
  const n = vm.rows.length;
  const half = n > 1 ? (scale.rowY(1) - scale.rowY(0)) / 2 : 0;
  let y = n === 0 ? (geom.plot.top + geom.plot.bottom) / 2 : vm.adv >= n ? scale.rowY(n - 1) + half : scale.rowY(vm.adv) - half;
  const { top, bottom } = geom.matrix;
  const h = bottom - top;
  y = Math.max(top + h * 0.2, Math.min(bottom - h * 0.2, y));
  return y;
}

function assign(vm: ViewModel, geom: Geom, splitY: number): Assignment {
  const posH = splitY - 3 * geom.ui - geom.matrix.top;
  const negH = geom.matrix.bottom - splitY - 3 * geom.ui;
  const posRows = vm.rows.filter((r) => r.pct! > 0);
  const negRows = vm.rows.filter((r) => r.pct! < 0).reverse();
  const posCounts = planBlock(posH, geom.ui, posRows.length);
  const negCounts = planBlock(negH, geom.ui, negRows.length);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    pos: posRows.slice(0, sum(posCounts)).map((r) => r.id),
    neg: negRows.slice(0, sum(negCounts)).map((r) => r.id),
    posCounts,
    negCounts,
    posH,
    negH,
  };
}

export default function App() {
  const snap = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [filters, setFiltersState] = useState<Filters>({ query: '', sector: 'ALL', tier: 'ALL', period: (['1D', '5D', '1M'].includes(params.get('period') ?? '') ? params.get('period') : '1D') as Filters['period'] });
  const setFilters = useCallback((f: Partial<Filters>) => setFiltersState((s) => ({ ...s, ...f })), []);
  const [settings, setSettingsState] = useState<Settings>({ density: 1, motion: 'system', rerankSec: 20 });
  const setSettings = (s: Partial<Settings>) => setSettingsState((o) => ({ ...o, ...s }));
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number; t?: number; v?: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | 'settings' | 'about'>(null);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [introStart, setIntroStart] = useState<number | null>(null);
  const [introKey, setIntroKey] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const [rerankTick, setRerankTick] = useState(0);
  const [mobileView, setMobileView] = useState<'field' | 'board'>('field');
  const searchRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0, vw: window.innerWidth });

  const sysReduced = usePrefersReducedMotion();
  const reduced = settings.motion === 'reduced' || (settings.motion === 'system' && sysReduced);

  // ── Size ──
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight, vw: window.innerWidth }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = size.vw < 900;
  const stageW = narrow ? Math.max(1240, size.w) : size.w;
  const stageH = narrow ? Math.max(620, size.h) : size.h;

  // ── Intro reveal: start once data is ready; replay on demand. ──
  useEffect(() => {
    if (snap && introStart == null) setIntroStart(INTRO_OFF ? -1e9 : performance.now());
  }, [snap, introStart]);
  useEffect(() => {
    if (introStart == null) return;
    setIntroDone(false);
    const t = setTimeout(() => setIntroDone(true), 6000);
    return () => clearTimeout(t);
  }, [introStart]);
  const effIntro = reduced || introStart == null ? -1e9 : introStart;
  const replay = () => {
    setIntroKey((k) => k + 1);
    setIntroStart(performance.now());
  };

  // ── Derived data (single source of truth for every view) ──
  const vm = useMemo(() => (snap ? derive(snap, filters) : null), [snap, filters]);
  const geom = useMemo(() => (stageW > 0 && stageH > 0 ? computeGeom(stageW, stageH, settings.density) : null), [stageW, stageH, settings.density]);
  const scale = useMemo(() => (vm && geom ? buildScale(vm.rows.map((r) => r.pct!), vm.gMin, vm.gMax, geom.plot.top, geom.plot.bottom) : null), [vm, geom]);
  const splitY = vm && scale && geom ? splitYOf(vm, scale, geom) : 0;

  // ── Card assignment: stable between re-ranks. ──
  const [asg, setAsg] = useState<Assignment | null>(null);
  const latest = useRef({ vm, geom, splitY });
  latest.current = { vm, geom, splitY };
  const doAssign = useCallback(() => {
    const { vm, geom, splitY } = latest.current;
    if (vm && geom) setAsg(assign(vm, geom, splitY));
  }, []);
  const hasData = !!vm;
  const filterKey = `${filters.query}|${filters.sector}|${filters.tier}|${filters.period}`;
  useEffect(() => {
    doAssign();
  }, [filterKey, geom, rerankTick, doAssign, hasData]);
  useEffect(() => {
    if (!settings.rerankSec || paused) return;
    const t = setInterval(doAssign, settings.rerankSec * 1000);
    return () => clearInterval(t);
  }, [settings.rerankSec, paused, doAssign]);
  // Re-rank early only if a block's height changed a lot (keeps cards legible).
  useEffect(() => {
    if (!asg || !geom) return;
    const posH = splitY - 3 * geom.ui - geom.matrix.top;
    const negH = geom.matrix.bottom - splitY - 3 * geom.ui;
    if (Math.abs(posH - asg.posH) / asg.posH > 0.3 || Math.abs(negH - asg.negH) / asg.negH > 0.3) doAssign();
  }, [splitY, asg, geom, doAssign]);

  const cards: PlacedCard[] = useMemo(() => {
    if (!asg || !geom || !vm) return [];
    const gap = 3 * geom.ui;
    const ps = placeBlock(geom.matrix.x0, geom.matrix.x1, geom.matrix.top, splitY - gap, geom.ui, asg.posCounts);
    const ns = placeBlock(geom.matrix.x0, geom.matrix.x1, splitY + gap, geom.matrix.bottom, geom.ui, asg.negCounts);
    const out: PlacedCard[] = [];
    asg.pos.forEach((id, i) => ps[i] && vm.byId.has(id) && vm.byId.get(id)!.rank >= 0 && out.push({ id, slot: ps[i], block: 'pos' }));
    asg.neg.forEach((id, i) => ns[i] && vm.byId.has(id) && vm.byId.get(id)!.rank >= 0 && out.push({ id, slot: ns[i], block: 'neg' }));
    return out;
  }, [asg, geom, vm, splitY]);

  // ── Controls ──
  const togglePause = () => {
    const p = !paused;
    setPaused(p);
    store.setPaused(p);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };
  useEffect(() => {
    const h = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === 'Escape') {
        if (selectedId) setSelectedId(null);
        else if (panel) setPanel(null);
        else if (document.activeElement === searchRef.current) searchRef.current?.blur();
      } else if (e.key === 'Enter' && document.activeElement === searchRef.current && vm?.rows.length) {
        const q = filters.query.trim().toUpperCase();
        const exact = vm.rows.find((r) => r.inst.symbol === q) ?? (vm.rows.length === 1 ? vm.rows[0] : null);
        if (exact) setSelectedId(exact.id);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selectedId, panel, vm, filters.query]);
  useEffect(() => {
    if (!narrow || !scrollRef.current || !geom) return;
    scrollRef.current.scrollTo({ left: mobileView === 'board' ? geom.corridor.x0 - 8 : 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [mobileView, narrow, geom, reduced]);

  const onHover = useCallback((id: string | null, pt?: { x: number; y: number; t?: number; v?: number }) => {
    setHoverId(id);
    setHoverPt(id && pt ? pt : null);
  }, []);
  const onHoverSimple = useCallback((id: string | null) => {
    setHoverId(id);
    setHoverPt(null);
  }, []);
  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  const hotId = hoverId ?? selectedId;
  const selectedRow = selectedId && vm ? vm.byId.get(selectedId) ?? null : null;
  const hoverRow = hoverId && vm ? vm.byId.get(hoverId) : null;
  const status = snap?.status ?? (store.error ? 'disconnected' : 'connecting');

  return (
    <div
      className={`app${reduced ? ' reduced' : ''}${introDone ? ' intro-done' : ''}${effIntro < 0 ? ' no-intro' : ''}${narrow ? ' narrow' : ''}`}
      style={{ ['--ui' as string]: geom?.ui ?? 1 }}
    >
      <Header
        ref={searchRef}
        filters={filters}
        setFilters={setFilters}
        universeCount={snap?.instruments.length ?? 0}
        shownCount={vm ? vm.rows.length + vm.invalid.length : 0}
        status={status}
        asOf={snap?.asOf ?? null}
        mobileView={narrow ? mobileView : null}
        onMobileView={setMobileView}
      />
      <div className="body">
        <Rail
          paused={paused}
          canPause={status !== 'closed' && !!snap}
          fullscreen={fullscreen}
          onPause={togglePause}
          onReplay={replay}
          onRerank={() => setRerankTick((t) => t + 1)}
          onFullscreen={toggleFullscreen}
          onSettings={() => setPanel(panel === 'settings' ? null : 'settings')}
          onAbout={() => setPanel(panel === 'about' ? null : 'about')}
        />
        <div className="stage-scroll" ref={scrollRef}>
          {!snap && <div className="loading">{store.error ? `Data source unavailable: ${store.error}` : 'Loading demo market…'}</div>}
          {vm && geom && scale && (
            <div className="stage" ref={stageRef} key={introKey} style={{ width: stageW, height: stageH }}>
              <FieldCanvas
                vm={vm}
                scale={scale}
                geom={geom}
                hotId={hotId}
                introStart={effIntro}
                tweenMs={reduced ? 0 : 650}
                guides={GUIDES[filters.period]}
                onHover={onHover}
                onSelect={onSelect}
              />
              <FieldOverlay
                vm={vm}
                scale={scale}
                geom={geom}
                posIds={asg?.pos ?? []}
                negIds={asg?.neg ?? []}
                sectorFilter={filters.sector}
                onSector={(s) => setFilters({ sector: s })}
              />
              <Connectors vm={vm} scale={scale} geom={geom} cards={cards} hotId={hotId} introDone={introDone} onHover={onHoverSimple} onSelect={onSelect} />
              <CardMatrix vm={vm} geom={geom} cards={cards} hotId={hotId} splitY={splitY} introDone={introDone} onHover={onHoverSimple} onSelect={onSelect} />
              {vm.rows.length === 0 && (
                <div className="empty" style={{ left: geom.plot.x0, top: geom.plot.top, width: geom.plot.x1 - geom.plot.x0 }}>
                  No instruments match “{filters.query || filters.sector}”.
                  <button type="button" onClick={() => setFilters({ query: '', sector: 'ALL', tier: 'ALL' })}>Clear filters</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {hoverRow && hoverPt && (
        <div className="tooltip" style={{ left: hoverPt.x + 14, top: hoverPt.y + 14 }}>
          <div className="tt-h">
            <b>{hoverRow.inst.symbol}</b>
            <span>{hoverRow.inst.sector}</span>
          </div>
          {hoverPt.v != null && (
            <div>
              {hoverPt.t != null && filters.period === '1D' && snap
                ? `at ${new Date(snap.session.open + hoverPt.t * (snap.asOf - snap.session.open)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`
                : 'at cursor'}
              : <span className={hoverPt.v >= 0 ? 'pos' : 'neg'}>{fmtPct(hoverPt.v)}</span>
            </div>
          )}
          <div>
            last {fmtPrice(hoverRow.last)} · <span className={(hoverRow.pct ?? 0) >= 0 ? 'pos' : 'neg'}>{fmtPct(hoverRow.pct)}</span> {vm?.refLabel}
          </div>
          <div className="tt-f">Rank {hoverRow.rank + 1}/{vm?.rows.length} · {vm?.rows.length} of {vm?.rows.length} filtered lines drawn · click for detail</div>
        </div>
      )}

      {vm && <DetailDrawer row={selectedRow} vm={vm} onClose={() => setSelectedId(null)} />}
      <SettingsDrawer
        open={!!panel}
        mode={panel ?? 'settings'}
        settings={settings}
        onChange={setSettings}
        onClose={() => setPanel(null)}
        seed={SEED}
        instrumentCount={snap?.instruments.length ?? 0}
      />
    </div>
  );
}
