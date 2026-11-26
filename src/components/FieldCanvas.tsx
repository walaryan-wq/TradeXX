/**
 * Canvas layer for the dense parts of the left field: grid, guides, ~200 trajectories,
 * endpoint marks and the endpoint strip. Redraws only when data, hover, size or the
 * intro timeline change; tweens between ticks for ~600 ms.
 */
import { useEffect, useRef } from 'react';
import type { Geom } from '../view/layout';
import type { Row, ViewModel } from '../view/derive';
import { mapY, yTicks, type YScale } from '../view/scale';
import { C, REVEAL, negRGB, phase, posRGB, rgbFor } from '../view/theme';

interface Props {
  vm: ViewModel;
  scale: YScale;
  geom: Geom;
  hotId: string | null;
  introStart: number;
  tweenMs: number;
  guides: number[];
  onHover: (id: string | null, e?: { x: number; y: number; t?: number; v?: number }) => void;
  onSelect: (id: string) => void;
}

interface Frame {
  vm: ViewModel;
  scale: YScale;
}

export function FieldCanvas({ vm, scale, geom, hotId, introStart, tweenMs, guides, onHover, onSelect }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const prev = useRef<Frame | null>(null);
  const cur = useRef<Frame>({ vm, scale });
  const tweenStart = useRef(0);
  const raf = useRef(0);
  const props = useRef({ geom, hotId, introStart, tweenMs, guides });
  props.current = { geom, hotId, introStart, tweenMs, guides };

  // New data → start a tween from the previously displayed frame.
  useEffect(() => {
    if (cur.current.vm !== vm || cur.current.scale !== scale) {
      prev.current = cur.current;
      cur.current = { vm, scale };
      tweenStart.current = performance.now();
    }
    kick();
  }, [vm, scale, geom, hotId, introStart, guides]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  function kick() {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  }

  function loop() {
    const now = performance.now();
    const { tweenMs, introStart } = props.current;
    const a = tweenMs > 0 && prev.current ? Math.min(1, (now - tweenStart.current) / tweenMs) : 1;
    const introT = (now - introStart) / 1000;
    draw(a < 1 ? 1 - Math.pow(1 - a, 3) : 1, introT);
    if (a < 1 || introT < REVEAL.strip[1] + 0.1) raf.current = requestAnimationFrame(loop);
  }

  function draw(alpha: number, introT: number) {
    const cv = ref.current;
    if (!cv) return;
    const { geom, hotId, guides } = props.current;
    const dpr = window.devicePixelRatio || 1;
    const W = geom.strip.x1 + 2;
    const H = geom.H;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
    }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const { vm, scale } = cur.current;
    const p = prev.current;
    const ui = geom.ui;
    const { plot, strip } = geom;
    const pw = plot.x1 - plot.x0;
    // Blend old and new scale in screen space for smooth motion.
    const Y = (v: number) => {
      const yn = mapY(scale, v);
      if (alpha >= 1 || !p) return yn;
      return mapY(p.scale, v) * (1 - alpha) + yn * alpha;
    };

    const gridA = phase(introT, REVEAL.grid);
    const trajP = phase(introT, REVEAL.traj);
    const stripP = phase(introT, REVEAL.strip);

    // ── Grid ───────────────────────────────────────────────
    ctx.globalAlpha = gridA;
    ctx.lineWidth = 1;
    for (const t of yTicks(scale, 15 * ui)) {
      const y = Math.round(Y(t.v)) + 0.5;
      ctx.strokeStyle = t.v === 0 ? 'rgba(220,232,239,0.28)' : 'rgba(23,48,64,0.75)';
      ctx.beginPath();
      ctx.moveTo(plot.x0, y);
      ctx.lineTo(plot.x1, y);
      ctx.stroke();
    }
    for (const tk of vm.timeTicks) {
      const x = Math.round(plot.x0 + tk.x * pw) + 0.5;
      ctx.strokeStyle = tk.major ? 'rgba(23,48,64,0.7)' : 'rgba(23,48,64,0.35)';
      ctx.beginPath();
      ctx.moveTo(x, plot.top);
      ctx.lineTo(x, plot.bottom);
      ctx.stroke();
    }
    // Blue horizontal guides at round % levels.
    for (const g of guides) {
      if (g > scale.vals[0] || g < scale.vals[scale.vals.length - 1]) continue;
      const y = Math.round(Y(g)) + 0.5;
      const grad = ctx.createLinearGradient(plot.x0, 0, strip.x0, 0);
      grad.addColorStop(0, 'rgba(61,100,221,0.08)');
      grad.addColorStop(0.55, 'rgba(61,100,221,0.55)');
      grad.addColorStop(1, 'rgba(61,100,221,0.9)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6 * ui;
      ctx.beginPath();
      ctx.moveTo(plot.x0, y);
      ctx.lineTo(plot.x1, y);
      ctx.stroke();
    }

    // Gradient axis bar (teal above zero, magenta below).
    const zeroY = Y(0);
    const barW = 2.5 * ui;
    const gx = geom.axisX - barW / 2;
    let g1 = ctx.createLinearGradient(0, plot.top, 0, zeroY);
    g1.addColorStop(0, 'rgba(0,214,174,0.25)');
    g1.addColorStop(1, 'rgba(0,214,174,0.95)');
    ctx.fillStyle = g1;
    ctx.fillRect(gx, plot.top, barW, Math.max(0, zeroY - plot.top));
    g1 = ctx.createLinearGradient(0, zeroY, 0, plot.bottom);
    g1.addColorStop(0, 'rgba(239,75,150,0.95)');
    g1.addColorStop(1, 'rgba(239,75,150,0.25)');
    ctx.fillStyle = g1;
    ctx.fillRect(gx, zeroY, barW, Math.max(0, plot.bottom - zeroY));
    ctx.fillStyle = C.text;
    ctx.beginPath();
    ctx.arc(geom.axisX, zeroY, 2.6 * ui, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ── Trajectories ───────────────────────────────────────
    const n = vm.rows.length;
    const clipX = plot.x0 + trajP * pw;
    ctx.save();
    ctx.beginPath();
    ctx.rect(plot.x0 - 2, plot.top - 30, clipX - plot.x0 + 2, plot.bottom - plot.top + 60);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    const dim = hotId ? 0.32 : 1;
    const prevLast = p ? p.vm.byId : null;
    for (const r of vm.rows) {
      if (r.id === hotId) continue;
      // Extremes slightly brighter; the middle stays quieter for depth.
      const ext = n > 1 ? Math.abs(r.rank / (n - 1) - 0.5) * 2 : 1;
      ctx.strokeStyle = `rgba(${rgbFor(r.pct)},${(0.16 + 0.42 * ext * ext) * dim})`;
      ctx.lineWidth = (0.65 + 0.5 * ext) * ui;
      strokeRow(ctx, r, Y, plot.x0, pw, alpha, prevLast?.get(r.id));
    }
    ctx.restore();

    // ── Endpoint marks ─────────────────────────────────────
    ctx.globalAlpha = trajP;
    for (const r of vm.rows) {
      if (r.pct == null) continue;
      const y = Y(lerpLast(r, alpha, prevLast?.get(r.id)));
      ctx.fillStyle = `rgba(${rgbFor(r.pct)},${hotId && hotId !== r.id ? 0.25 : 0.75})`;
      ctx.fillRect(plot.x1 - 7 * ui, y - 0.5, 6 * ui, 1);
    }
    ctx.globalAlpha = 1;

    // ── Endpoint strip ─────────────────────────────────────
    const sw = strip.x1 - strip.x0;
    if (stripP > 0 && n > 0) {
      ctx.globalAlpha = stripP;
      const top = scale.rowY(0) - (scale.rowY(1) - scale.rowY(0)) / 2;
      const splitRank = vm.adv;
      const splitY = n ? (splitRank < n ? scale.rowY(splitRank) - (scale.rowY(1) - scale.rowY(0)) / 2 : scale.rowY(n - 1) + 2) : zeroY;
      const bot = scale.rowY(n - 1) + (n > 1 ? (scale.rowY(1) - scale.rowY(0)) / 2 : 4);
      let gr = ctx.createLinearGradient(strip.x0, 0, strip.x1, 0);
      gr.addColorStop(0, `rgba(${posRGB},0.16)`);
      gr.addColorStop(1, `rgba(${posRGB},0.03)`);
      ctx.fillStyle = gr;
      ctx.fillRect(strip.x0, top, sw * stripP, splitY - top);
      gr = ctx.createLinearGradient(strip.x0, 0, strip.x1, 0);
      gr.addColorStop(0, `rgba(${negRGB},0.16)`);
      gr.addColorStop(1, `rgba(${negRGB},0.03)`);
      ctx.fillStyle = gr;
      ctx.fillRect(strip.x0, splitY, sw * stripP, bot - splitY);

      const maxAbs = Math.max(1e-6, ...vm.rows.map((r) => Math.abs(r.pct!)));
      const rowH = n > 1 ? scale.rowY(1) - scale.rowY(0) : 6;
      const prevScale = p?.scale;
      for (const r of vm.rows) {
        const yNew = scale.rowY(r.rank);
        const pr = prevLast?.get(r.id);
        const yOld = prevScale && pr && pr.rank >= 0 ? prevScale.rowY(pr.rank) : yNew;
        const y = yOld + (yNew - yOld) * alpha;
        const len = (0.12 + 0.88 * Math.sqrt(Math.abs(r.pct!) / maxAbs)) * (sw - 4 * ui) * stripP;
        const hot = r.id === hotId;
        ctx.fillStyle = `rgba(${rgbFor(r.pct)},${hot ? 1 : hotId ? 0.3 : 0.62})`;
        ctx.fillRect(strip.x0 + 2 * ui, y - Math.max(0.6, rowH * 0.32), len, Math.max(1, rowH * 0.64));
      }
      ctx.globalAlpha = 1;
    }
    // Bright boundary line between the field and the strip.
    const lg = ctx.createLinearGradient(0, plot.top, 0, plot.bottom);
    lg.addColorStop(0, 'rgba(220,232,239,0.15)');
    lg.addColorStop(0.5, 'rgba(220,232,239,0.75)');
    lg.addColorStop(1, 'rgba(220,232,239,0.15)');
    ctx.globalAlpha = trajP;
    ctx.fillStyle = lg;
    ctx.fillRect(strip.x0 - 1, plot.top - 6, 1.5, plot.bottom - plot.top + 12);
    ctx.globalAlpha = 1;

    // ── Hot trajectory on top ──────────────────────────────
    const hot = hotId ? vm.byId.get(hotId) : null;
    if (hot && hot.pct != null) {
      ctx.save();
      ctx.shadowColor = `rgba(${rgbFor(hot.pct)},0.9)`;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = hot.pct >= 0 ? C.pos2 : '#FF77B4';
      ctx.lineWidth = 1.8 * ui;
      strokeRow(ctx, hot, Y, plot.x0, pw, alpha, prevLast?.get(hot.id));
      ctx.restore();
      const y = Y(hot.pct);
      ctx.fillStyle = C.text;
      ctx.beginPath();
      ctx.arc(plot.x1, y, 3 * ui, 0, Math.PI * 2);
      ctx.fill();
      // Link endpoint to its strip row.
      ctx.strokeStyle = `rgba(${rgbFor(hot.pct)},0.9)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(plot.x1, y);
      ctx.lineTo(strip.x0 + 2, scale.rowY(hot.rank));
      ctx.lineTo(strip.x1, scale.rowY(hot.rank));
      ctx.stroke();
    }
  }

  // ── Hit-testing ─────────────────────────────────────────
  function pick(clientX: number, clientY: number) {
    const cv = ref.current;
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const { geom } = props.current;
    const { vm, scale } = cur.current;
    if (y < geom.plot.top - 8 || y > geom.plot.bottom + 8) return null;
    if (x >= geom.strip.x0 && x <= geom.strip.x1) {
      let best: Row | null = null;
      let bd = Infinity;
      for (const r of vm.rows) {
        const d = Math.abs(scale.rowY(r.rank) - y);
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      return best && bd < 6 ? { id: best.id, x, y, v: best.pct ?? undefined } : null;
    }
    if (x < geom.plot.x0 || x > geom.plot.x1) return null;
    const fx = (x - geom.plot.x0) / (geom.plot.x1 - geom.plot.x0);
    let best: Row | null = null;
    let bd = Infinity;
    let bv = 0;
    for (const r of vm.rows) {
      const xs = r.xs;
      if (!xs.length || fx > xs[xs.length - 1] + 0.005) continue;
      let lo = 0;
      let hi = xs.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (xs[m] <= fx) lo = m;
        else hi = m;
      }
      const t = xs[hi] > xs[lo] ? Math.min(1, Math.max(0, (fx - xs[lo]) / (xs[hi] - xs[lo]))) : 0;
      const v = r.ys[lo] + (r.ys[hi] - r.ys[lo]) * t;
      const d = Math.abs(mapY(scale, v) - y);
      if (d < bd) {
        bd = d;
        best = r;
        bv = v;
      }
    }
    return best && bd < 8 ? { id: best.id, x, y, t: fx, v: bv } : null;
  }

  return (
    <canvas
      ref={ref}
      className="field-canvas"
      aria-label="Performance trajectories (% change from reference) and endpoint rank strip"
      role="img"
      onMouseMove={(e) => {
        const hit = pick(e.clientX, e.clientY);
        onHover(hit?.id ?? null, hit ? { x: e.clientX, y: e.clientY, t: hit.t, v: hit.v } : undefined);
      }}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        const hit = pick(e.clientX, e.clientY);
        if (hit) onSelect(hit.id);
      }}
      style={{ cursor: 'crosshair' }}
    />
  );
}

function lerpLast(r: Row, a: number, pr: Row | undefined) {
  if (a >= 1 || !pr || pr.pct == null) return r.pct!;
  return pr.pct + (r.pct! - pr.pct) * a;
}

function strokeRow(
  ctx: CanvasRenderingContext2D,
  r: Row,
  Y: (v: number) => number,
  x0: number,
  pw: number,
  a: number,
  pr: Row | undefined,
) {
  const xs = r.xs;
  const ys = r.ys;
  const m = xs.length;
  if (m < 2) return;
  ctx.beginPath();
  ctx.moveTo(x0 + xs[0] * pw, Y(ys[0]));
  for (let i = 1; i < m - 1; i++) ctx.lineTo(x0 + xs[i] * pw, Y(ys[i]));
  // Interpolate the live end of the line between updates.
  const lastV = a < 1 && pr && pr.ys.length ? pr.ys[pr.ys.length - 1] + (ys[m - 1] - pr.ys[pr.ys.length - 1]) * a : ys[m - 1];
  ctx.lineTo(x0 + xs[m - 1] * pw, Y(lastV));
  ctx.stroke();
}
