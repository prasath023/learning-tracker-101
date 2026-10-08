import { useEffect, useRef, useState } from 'react';
import { dkey, fmt } from '../lib/dates';
import { entry } from '../lib/stats';
import { timerElapsed, useNow } from '../lib/useTracker';
import { Dot, TimerClock } from './ui';

const touchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;
const portraitNow = () => window.matchMedia?.('(orientation: portrait)').matches ?? false;

/**
 * Zen mode: full-screen, distraction-free view of the timer. Uses the Fullscreen API + screen wake lock when
 * available. Orientation: tries a real screen.orientation.lock(); where the browser
 * refuses (e.g. iPhone Safari), touch devices get the stage rotated 90° in CSS instead.
 */
export default function ZenMode({ state, actions, onClose }) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // last choice, or however the phone is held right now
  const saved = state.ui.zenOrient;
  const [orient, setOrientState] = useState(() => (saved === 'landscape' || saved === 'portrait' ? saved : portraitNow() ? 'portrait' : 'landscape'));
  const [spins, setSpins] = useState(0); // drives the arrow spin animation on each toggle
  const [isPortrait, setIsPortrait] = useState(portraitNow);
  const [lockedTo, setLockedTo] = useState(null); // orientation the browser actually locked to
  const [fsTick, setFsTick] = useState(0); // bumps when fullscreen state changes
  const [isTouch] = useState(touchDevice);

  const toggleOrient = () => {
    const next = orient === 'portrait' ? 'landscape' : 'portrait';
    setOrientState(next);
    setSpins((n) => n + 1);
    actions.setUi({ zenOrient: next });
  };

  // keep the screen awake while open; leave fullscreen on close.
  // (Fullscreen itself is requested by the button that opens this view — browsers
  // only allow it inside the click handler.)
  useEffect(() => {
    let wake = null;
    let wentFullscreen = !!document.fullscreenElement;
    navigator.wakeLock?.request('screen').then((w) => { wake = w; }, () => {});

    const onFs = () => {
      setFsTick((n) => n + 1);
      if (document.fullscreenElement) wentFullscreen = true;
      // user left fullscreen with the system gesture / Esc → close zen mode too
      else if (wentFullscreen) closeRef.current();
    };
    const onKey = (e) => e.key === 'Escape' && !document.fullscreenElement && closeRef.current();
    const mq = window.matchMedia?.('(orientation: portrait)');
    const onOrient = () => setIsPortrait(portraitNow());
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('keydown', onKey);
    mq?.addEventListener?.('change', onOrient);
    window.addEventListener('resize', onOrient);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('keydown', onKey);
      mq?.removeEventListener?.('change', onOrient);
      window.removeEventListener('resize', onOrient);
      wake?.release().catch(() => {});
      try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // try a real orientation lock (needs fullscreen; retried when fullscreen kicks in)
  useEffect(() => {
    let cancelled = false;
    const lock = screen.orientation?.lock?.(orient);
    (lock || Promise.reject(new Error('unsupported'))).then(
      () => !cancelled && setLockedTo(orient),
      () => !cancelled && setLockedTo(null),
    );
    return () => { cancelled = true; };
  }, [orient, fsTick]);

  // CSS fallback: rotate the stage when the wanted orientation doesn't match the screen
  const wantsLandscape = orient === 'landscape';
  const rotated = isTouch && lockedTo !== orient && wantsLandscape === isPortrait;

  const t = state.timer;
  const s = state.subjects.find((x) => x.id === t?.sid);
  const active = !!(t && s);
  const now = useNow(1000, !!t?.start);
  const todayMin = s ? entry(state, dkey(new Date(now)), s.id).min + (t.start ? (Math.max(now, t.start) - t.start) / 60000 : 0) : 0;
  const goal = s?.goal || 60;
  const pct = Math.min(100, (todayMin / goal) * 100);
  const sessionMin = active ? timerElapsed(t, Math.max(now, t.start || 0)) / 60000 : 0;

  return (
    <div className="fs" role="dialog" aria-label="Zen mode" style={s ? { '--c': s.color } : undefined}>
      <div className={`fs-stage ${rotated ? 'rotated' : ''} ${active && !t.start ? 'paused' : ''}`}>
        <div className="fs-top">
          <div className="fs-brand">Zen mode</div>
          <div className="fs-top-actions">
            {isTouch && (
              <button
                className={`fs-rotate ${orient}`}
                onClick={toggleOrient}
                title={`Switch to ${orient === 'portrait' ? 'landscape' : 'portrait'}`}
                aria-label={`Orientation: ${orient}. Tap to switch to ${orient === 'portrait' ? 'landscape' : 'portrait'}`}
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <g className="rot-arrows" style={{ transform: `rotate(${spins * 180}deg)` }}>
                    <path d="M4.6 9.2A8 8 0 0 1 17.4 5.6" />
                    <path d="M17.6 2.4v3.4h-3.4" />
                    <path d="M19.4 14.8A8 8 0 0 1 6.6 18.4" />
                    <path d="M6.4 21.6v-3.4h3.4" />
                  </g>
                  <rect className="rot-phone" x="9.25" y="7" width="5.5" height="10" rx="1.4" />
                  <circle className="rot-cam" cx="12" cy="8.6" r=".55" />
                </svg>
              </button>
            )}
            <button className="fs-exit" onClick={onClose} title="Exit zen mode (Esc)" aria-label="Exit zen mode">✕</button>
          </div>
        </div>

        {active ? (
          <div className="fs-main">
            <div className="fs-subject"><Dot color={s.color} /> {s.name} <span className="fs-status">{t.start ? 'Studying' : 'Paused'}</span></div>
            <div className="fs-clock"><TimerClock timer={t} /></div>
            <div className="fs-progress">
              <div className="fs-bar"><i style={{ width: `${pct}%` }} /></div>
              <div className="fs-meta">
                <span>Today {fmt(todayMin)} / {fmt(goal)}</span>
                <span>This session {fmt(sessionMin)}</span>
              </div>
            </div>
            <div className="fs-controls">
              {t.start ? (
                <button className="fs-btn main" onClick={actions.pauseTimer} aria-label="Pause" title="Pause">
                  <svg viewBox="0 0 24 24" aria-hidden><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" /></svg>
                </button>
              ) : (
                <button className="fs-btn main play" onClick={actions.resumeTimer} aria-label="Resume" title="Resume">
                  <svg viewBox="0 0 24 24" aria-hidden><path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" /></svg>
                </button>
              )}
              <button className="fs-btn stop" onClick={actions.stopTimer} aria-label="Stop" title="Stop">
                <svg viewBox="0 0 24 24" aria-hidden><rect x="6" y="6" width="12" height="12" rx="2.2" /></svg>
              </button>
            </div>
          </div>
        ) : (
          <div className="fs-main">
            <div className="fs-idle">Pick a subject to begin</div>
            <div className="fs-pick">
              {state.subjects.map((x) => (
                <button key={x.id} style={{ '--c': x.color }} onClick={() => actions.startTimer(x.id)}>
                  <Dot color={x.color} /> {x.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
