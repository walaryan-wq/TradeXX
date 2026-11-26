export type Motion = 'system' | 'reduced' | 'full';
export interface Settings {
  density: number;
  motion: Motion;
  rerankSec: number; // 0 = manual
}

interface Props {
  open: boolean;
  mode: 'settings' | 'about';
  settings: Settings;
  onChange: (s: Partial<Settings>) => void;
  onClose: () => void;
  seed: number;
  instrumentCount: number;
}

export function SettingsDrawer({ open, mode, settings, onChange, onClose, seed, instrumentCount }: Props) {
  return (
    <aside className={`drawer settings${open ? ' open' : ''}`} aria-hidden={!open} aria-label={mode === 'settings' ? 'Settings' : 'About'}>
      <div className="d-head">
        <h2>{mode === 'settings' ? 'Display' : 'About this data'}</h2>
        <button type="button" className="x" onClick={onClose} aria-label="Close">×</button>
      </div>
      {mode === 'settings' ? (
        <div className="set-body">
          <fieldset>
            <legend>Density</legend>
            {[
              [0.86, 'Compact'],
              [1, 'Default'],
              [1.14, 'Comfortable'],
            ].map(([v, l]) => (
              <label key={l} className="radio">
                <input type="radio" name="density" checked={settings.density === v} onChange={() => onChange({ density: v as number })} /> {l}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Motion</legend>
            {(['system', 'reduced', 'full'] as Motion[]).map((m) => (
              <label key={m} className="radio">
                <input type="radio" name="motion" checked={settings.motion === m} onChange={() => onChange({ motion: m })} /> {m === 'system' ? 'Follow system' : m === 'reduced' ? 'Reduced' : 'Full'}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>Card ranking refresh</legend>
            {[
              [10, 'Every 10 s'],
              [20, 'Every 20 s'],
              [60, 'Every 60 s'],
              [0, 'Manual only'],
            ].map(([v, l]) => (
              <label key={l} className="radio">
                <input type="radio" name="rerank" checked={settings.rerankSec === v} onChange={() => onChange({ rerankSec: v as number })} /> {l}
              </label>
            ))}
            <p className="hint">Card values update every tick. Which stocks occupy which card is refreshed on this cadence so the board stays trackable.</p>
          </fieldset>
        </div>
      ) : (
        <div className="set-body about">
          <p><b>DEMO DATA.</b> Every price, volume and timestamp comes from a deterministic simulator (seed {seed}, {instrumentCount} sample NSE-style symbols). There is no market connection and nothing here is a quote, recommendation or signal.</p>
          <p><b>Chart.</b> Each line is an instrument's % change from the period reference (1D: previous close; 5D/1M: close before the window). The y-axis is rank-scaled so each latest value lands on its own row in the endpoint strip; tick labels show true % values.</p>
          <p><b>Counters.</b> Bullish / bearish = instruments above / below reference in the current filter.</p>
          <p><b>Histogram.</b> Net breadth over time (# above − # below reference).</p>
          <p><b>Connectors.</b> Link an instrument's strip row to its card. Constant width; they do not represent capital or order flow.</p>
          <p><b>Profile bars.</b> Simulated volume-at-price computed from today's simulated 1-minute bars. No order book is connected.</p>
          <p><b>Tags.</b> VOL n× = today's volume vs expected by this time of day. P = percentile rank of % change.</p>
          <p>Add <code>?seed=7&amp;start=13:30&amp;intro=0</code> to the URL for a different, repeatable session.</p>
        </div>
      )}
    </aside>
  );
}
