import { useEffect, useRef, useState } from 'react';
import ZenMode from './ZenMode';
import { Dot, TimerClock } from './ui';

const DEFAULT_POS = { fx: 1, fy: 0.88 };
const EDGE = 12; // keep this far from the viewport edges
const PANEL_W = 300;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/**
 * Floating timer that can be dragged anywhere. Collapsed it's a small button
 * (showing the live time while a session is active); expanded it has full controls,
 * or a subject picker to start a session when nothing is running.
 * Position is stored as a fraction of the free space, so it survives window resizes.
 */
export default function FloatingTimer({ state, actions }) {
  const open = !!state.ui.timerOpen;
  const savedPos = state.ui.timerPos || DEFAULT_POS;
  const [dragPos, setDragPos] = useState(null); // live position while dragging, saved on release
  const frac = dragPos || savedPos;
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  const [fab, setFab] = useState({ w: 110, h: 50 });
  const [dragging, setDragging] = useState(false);
  const [zen, setZen] = useState(false);
  const fabRef = useRef(null);
  const drag = useRef(null);
  const justDragged = useRef(false);

  const setOpen = (v) => actions.setUi({ timerOpen: v });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // track the button's real size (it changes between "Timer" and a running clock)
  useEffect(() => {
    const el = fabRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setFab((f) => (Math.abs(f.w - r.width) > 1 || Math.abs(f.h - r.height) > 1 ? { w: r.width, h: r.height } : f));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const maxX = Math.max(EDGE, vp.w - fab.w - EDGE);
  const maxY = Math.max(EDGE, vp.h - fab.h - EDGE);
  const x = EDGE + clamp(frac.fx, 0, 1) * (maxX - EDGE);
  const y = EDGE + clamp(frac.fy, 0, 1) * (maxY - EDGE);
  const toFrac = (nx, ny) => ({
    fx: maxX > EDGE ? (nx - EDGE) / (maxX - EDGE) : 0,
    fy: maxY > EDGE ? (ny - EDGE) / (maxY - EDGE) : 0,
  });

  // pointer drag shared by the button and the panel header
  const dragHandlers = {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      const btn = e.target.closest('button');
      if (btn && btn !== e.currentTarget) return; // let buttons inside the panel header (✕) click
      drag.current = { sx: e.clientX, sy: e.clientY, x0: x, y0: y, moved: false, last: null };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) < 6) return; // small wiggle = still a tap
      if (!d.moved) setDragging(true);
      d.moved = true;
      d.last = toFrac(clamp(d.x0 + dx, EDGE, maxX), clamp(d.y0 + dy, EDGE, maxY));
      setDragPos(d.last);
    },
    onPointerUp: () => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      // swallow the click that follows a mouse drag; reset on the next tick because
      // touch drags (or releasing outside the window) never produce that click
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 0);
      setDragging(false);
      actions.setUi({ timerPos: d.last });
      setDragPos(null);
    },
    onPointerCancel: () => {
      drag.current = null;
      setDragging(false);
      setDragPos(null);
    },
  };

  const t = state.timer;
  const s = state.subjects.find((x2) => x2.id === t?.sid);
  const active = !!(t && s);
  const tint = s ? { '--c': s.color } : {};

  const openZen = () => {
    // must be called from the click itself, or the browser refuses fullscreen
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
    setZen(true);
  };
  if (zen) return <ZenMode state={state} actions={actions} onClose={() => setZen(false)} />;

  if (!open) {
    return (
      <button
        ref={fabRef}
        className={`ft-fab ${active ? 'active' : ''} ${active && !t.start ? 'paused' : ''} ${dragging ? 'dragging' : ''}`}
        style={{ ...tint, left: x, top: y }}
        {...dragHandlers}
        onClick={() => {
          if (justDragged.current) {
            justDragged.current = false;
            return;
          }
          setOpen(true);
        }}
        title={active ? `${s.name} — tap to open, drag to move` : 'Timer — tap to open, drag to move'}
        aria-label="Open timer"
      >
        {active ? <><i className="ft-dot" /><TimerClock timer={t} /></> : <span className="ft-label">Timer</span>}
      </button>
    );
  }

  // open the panel from the button's corner towards the middle of the screen
  const pw = Math.min(PANEL_W, vp.w - EDGE * 2);
  const left = clamp(x + fab.w / 2 > vp.w / 2 ? x + fab.w - pw : x, EDGE, vp.w - pw - EDGE);
  const place = y + fab.h / 2 > vp.h / 2 ? { bottom: Math.max(EDGE, vp.h - (y + fab.h)) } : { top: y };

  return (
    <div
      className={`ft-panel ${active ? 'active' : ''} ${active && !t.start ? 'paused' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ ...tint, left, width: pw, ...place }}
      role="dialog"
      aria-label="Timer"
    >
      <div className="ft-head" {...dragHandlers} title="Drag to move">
        <span className="ft-grip" aria-hidden />
        <span className="ft-title">{active ? (t.start ? 'Studying' : 'Paused') : 'Start a session'}</span>
        <button className="ft-icon" onClick={openZen} aria-label="Zen mode (full screen)" title="Zen mode">⛶</button>
        <button className="ft-close" onClick={() => setOpen(false)} aria-label="Minimise timer" title="Minimise">✕</button>
      </div>
      {active ? (
        <>
          <div className="ft-subject"><Dot color={s.color} /> {s.name}</div>
          <div className="ft-clock"><TimerClock timer={t} /></div>
          <div className="ft-actions">
            {t.start
              ? <button onClick={actions.pauseTimer}>⏸ Pause</button>
              : <button className="primary" onClick={actions.resumeTimer}>▶ Resume</button>}
            <button className="danger" onClick={actions.stopTimer}>■ Stop</button>
          </div>
        </>
      ) : state.subjects.length ? (
        <div className="ft-pick">
          {state.subjects.map((x2) => (
            <button key={x2.id} style={{ '--c': x2.color }} onClick={() => actions.startTimer(x2.id)}>
              <Dot color={x2.color} /> {x2.name}
              <span className="ft-play">▶</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small-text">Add a subject first.</p>
      )}
    </div>
  );
}
