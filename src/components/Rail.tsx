import { IconExitFull, IconFull, IconInfo, IconPause, IconPlay, IconRank, IconReplay, IconSliders } from './icons';

interface Props {
  paused: boolean;
  canPause: boolean;
  fullscreen: boolean;
  onPause: () => void;
  onReplay: () => void;
  onRerank: () => void;
  onFullscreen: () => void;
  onSettings: () => void;
  onAbout: () => void;
}

export function Rail(p: Props) {
  return (
    <nav className="rail" aria-label="Dashboard actions">
      <button type="button" onClick={p.onPause} disabled={!p.canPause} title={p.paused ? 'Resume simulated stream' : 'Pause simulated stream'} aria-pressed={p.paused} className={p.paused ? 'on' : ''}>
        {p.paused ? <IconPlay /> : <IconPause />}
      </button>
      <button type="button" onClick={p.onRerank} title="Re-rank cards now">
        <IconRank />
      </button>
      <button type="button" onClick={p.onReplay} title="Replay intro animation">
        <IconReplay />
      </button>
      <div className="rail-spacer" />
      <button type="button" onClick={p.onSettings} title="Display settings (density, motion, ranking)">
        <IconSliders />
      </button>
      <button type="button" onClick={p.onAbout} title="About this data">
        <IconInfo />
      </button>
      <button type="button" onClick={p.onFullscreen} title={p.fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
        {p.fullscreen ? <IconExitFull /> : <IconFull />}
      </button>
    </nav>
  );
}
