import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fmtClock } from '../lib/dates';
import { timerElapsed, useNow } from '../lib/useTracker';

export function Dot({ color }) {
  return <span className="dot" style={{ '--c': color }} />;
}

export function Bar({ pct, color }) {
  return (
    <div className="bar" style={color ? { '--c': color } : undefined}>
      <i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <h3>{title}</h3>
        {children}
        {footer && <div className="actions">{footer}</div>}
      </div>
    </div>
  );
}

/** One global tooltip: any element with a `data-tip` attribute shows it on hover. */
export function Tooltip() {
  const [tip, setTip] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const over = (e) => {
      const el = e.target.closest?.('[data-tip]');
      setTip(el ? { text: el.dataset.tip, rect: el.getBoundingClientRect() } : null);
    };
    const hide = () => setTip(null);
    document.addEventListener('mouseover', over);
    document.addEventListener('scroll', hide, true);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('scroll', hide, true);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!tip || !el) return;
    const tr = el.getBoundingClientRect();
    const r = tip.rect;
    let x = r.left + r.width / 2 - tr.width / 2;
    let y = r.top - tr.height - 8;
    if (y < 4) y = r.bottom + 8;
    x = Math.max(4, Math.min(x, window.innerWidth - tr.width - 4));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.visibility = 'visible';
  }, [tip]);

  if (!tip) return null;
  return (
    <div id="tip" ref={ref} style={{ visibility: 'hidden' }}>
      {tip.text}
    </div>
  );
}

export function Splash({ text = 'Loading…' }) {
  return <div className="splash muted">{text}</div>;
}

export function TimerClock({ timer }) {
  const now = useNow(1000, !!timer.start);
  // `now` can lag one tick right after resuming, so never let it go before `start`
  return <span className="timer">{fmtClock(timerElapsed(timer, Math.max(now, timer.start || 0)))}</span>;
}

/** App wordmark: "LRN" in the text colour, "daily" in the accent. */
export function Brand() {
  return <span className="brand-name" aria-label="LRNdaily">LRN<span>daily</span></span>;
}

/**
 * Row of buttons with a highlight that slides to the active one. The row scrolls
 * horizontally when it doesn't fit (swipe on mobile) and keeps the active item in view.
 * items: [{ id, label, extra?, color? }] — `color` tints the highlight for that item.
 */
export function SlidingTabs({ items, value, onChange, className = '', label }) {
  const navRef = useRef(null);
  const indRef = useRef(null);
  const placed = useRef(false);
  const activeColor = items.find((it) => it.id === value)?.color;

  useLayoutEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      const el = nav?.querySelector('button.active');
      const ind = indRef.current;
      if (!el || !ind) return;
      // first placement jumps straight to the active item; later changes slide
      if (!placed.current) ind.style.transition = 'none';
      ind.style.width = `${el.offsetWidth}px`;
      ind.style.transform = `translateX(${el.offsetLeft}px)`;
      if (nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2, behavior: placed.current ? 'smooth' : 'auto' });
      }
      if (!placed.current) {
        void ind.offsetWidth; // flush styles before re-enabling the transition
        ind.style.transition = '';
        placed.current = true;
      }
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, items.length]);

  return (
    <nav className={`slide-tabs ${className}`} ref={navRef} aria-label={label}>
      <span className="tab-indicator" ref={indRef} style={activeColor ? { '--c': activeColor } : undefined} aria-hidden />
      {items.map((it) => (
        <button
          key={it.id}
          className={it.id === value ? 'active' : ''}
          aria-current={it.id === value ? 'true' : undefined}
          onClick={() => onChange(it.id)}
        >
          {it.label}
          {it.extra != null && <span className="tab-extra">{it.extra}</span>}
        </button>
      ))}
    </nav>
  );
}

const ICONS = {
  play: <path d="M8 5.2v13.6a1 1 0 0 0 1.53.85l10.6-6.8a1 1 0 0 0 0-1.7L9.53 4.35A1 1 0 0 0 8 5.2Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2.2" fill="currentColor" stroke="none" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  pencil: <><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4Z" /><path d="M13.5 6.5l4 4" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  flame: <path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.3 1.9 1.3 3 2.4 3.5C11.4 6.6 13 4.3 15 3c-.3 2.7.6 4.4 1.9 6 1 1.3 1.6 2.6 1.6 4.4C18.5 18.1 15.9 21 12 21Z" />,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>,
};

/** Small inline SVG icon set (stroke icons inherit the text colour). */
export function Icon({ name, size = 16 }) {
  return (
    <svg className="ico" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

/** Circular progress ring; children render in the middle. */
export function Ring({ pct, size = 88, stroke = 8, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, pct));
  return (
    <div className={`ring ${p >= 100 ? 'full' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="ring-fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

/** Round sun / moon button that flips between light and dark mode. */
export function ThemeToggle({ theme, onToggle }) {
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button className={`theme-btn ${dark ? 'dark' : ''}`} onClick={onToggle} title={label} aria-label={label}>
      <svg className="sun" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
      </svg>
      <svg className="moon" viewBox="0 0 24 24" aria-hidden>
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
      </svg>
    </button>
  );
}
