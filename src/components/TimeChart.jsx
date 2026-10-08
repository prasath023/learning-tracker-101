import { useState } from 'react';
import { addDays, DAYS, fmt, mondayOf, MONTHS, niceDate, sod } from '../lib/dates';
import { Bar, Dot } from './ui';

// [id, tab label, unit, bars shown, "current" name]
const PERIODS = [
  ['daily', 'Daily', 'day', 14, 'Today'],
  ['weekly', 'Weekly', 'week', 12, 'This week'],
  ['monthly', 'Monthly', 'month', 12, 'This month'],
];

/** The period `back` steps before the current one (0 = today / this week / this month). */
function bucket(period, now, back) {
  const today = sod(new Date(now));
  if (period === 'daily') {
    const d = addDays(today, -back);
    return { from: d, to: addDays(d, 1), label: back === 0 ? 'Today' : `${DAYS[d.getDay()].slice(0, 2)} ${d.getDate()}`, title: back === 0 ? 'Today' : back === 1 ? 'Yesterday' : niceDate(d) };
  }
  if (period === 'weekly') {
    const f = addDays(mondayOf(today), -7 * back);
    const l = addDays(f, 6);
    const title = back === 0 ? 'This week' : back === 1 ? 'Last week' : `${MONTHS[f.getMonth()]} ${f.getDate()} – ${MONTHS[l.getMonth()]} ${l.getDate()}`;
    return { from: f, to: addDays(f, 7), label: `${MONTHS[f.getMonth()]} ${f.getDate()}`, title };
  }
  const f = new Date(today.getFullYear(), today.getMonth() - back, 1);
  const yr = f.getMonth() === 0 ? ` '${String(f.getFullYear()).slice(2)}` : '';
  const name = `${MONTHS[f.getMonth()]} ${f.getFullYear()}`;
  return { from: f, to: new Date(f.getFullYear(), f.getMonth() + 1, 1), label: MONTHS[f.getMonth()] + yr, title: back === 0 ? `This month · ${name}` : back === 1 ? `Last month · ${name}` : name };
}

export default function TimeChart({ state, stats, now, actions }) {
  const period = state.ui.period || 'daily';
  const [, , unit, count, currentName] = PERIODS.find((p) => p[0] === period);
  // selected period (steps back from now) and the oldest/newest bars in view
  const [sel, setSel] = useState(0);
  const [win, setWin] = useState(0); // steps back of the newest bar shown

  const measure = (back) => {
    const b = bucket(period, now, back);
    const per = state.subjects.map((s) => ({ s, m: stats.minutesRange(b.from, b.to, s.id) }));
    return { ...b, back, per, total: per.reduce((a, x) => a + x.m, 0) };
  };
  const bs = Array.from({ length: count }, (_, i) => measure(win + count - 1 - i));
  const max = Math.max(1, ...bs.map((b) => b.total));
  const total = bs.reduce((a, b) => a + b.total, 0);

  const select = (back) => {
    const b = Math.max(0, back);
    setSel(b);
    if (b < win) setWin(b);
    else if (b > win + count - 1) setWin(b - count + 1);
  };
  const changePeriod = (v) => {
    setSel(0);
    setWin(0);
    actions.setUi({ period: v });
  };

  const cur = measure(sel);
  const prev = measure(sel + 1);
  const diff = cur.total - prev.total;
  const pct = prev.total ? Math.round((diff / prev.total) * 100) : null;

  return (
    <section>
      <h2>
        Time spent
        <span className="seg">
          {PERIODS.map(([v, label]) => (
            <button key={v} className={v === period ? 'on' : ''} onClick={() => changePeriod(v)}>{label}</button>
          ))}
        </span>
      </h2>
      <div className="card">
        <div className="chart-nav">
          <button className="icon-btn" onClick={() => select(sel + 1)} aria-label={`Previous ${unit}`} title={`Previous ${unit}`}>‹</button>
          <b className="chart-nav-title">{cur.title}</b>
          <button className="icon-btn" onClick={() => select(sel - 1)} disabled={sel === 0} aria-label={`Next ${unit}`} title={`Next ${unit}`}>›</button>
          {sel > 0 && <button className="small now-btn" onClick={() => select(0)} title={`Back to ${currentName.toLowerCase()}`}>Now</button>}
        </div>
        <div className="chart">
          {bs.map((b, i) => {
            const tip = [b.title, `Total: ${fmt(b.total)}`, ...b.per.filter((x) => x.m > 0).map((x) => `${x.s.name}: ${fmt(x.m)}`)].join('\n');
            return (
              <button
                key={`${period}-${b.back}`}
                className={`col ${b.back === 0 ? 'cur' : ''} ${b.back === sel ? 'sel' : ''}`}
                data-tip={tip}
                style={{ '--i': i }}
                onClick={() => select(b.back)}
                aria-pressed={b.back === sel}
                aria-label={`${b.title}: ${fmt(b.total)}`}
              >
                <div className="tot">{b.total ? fmt(b.total) : ''}</div>
                <div className="stack">
                  {b.per.filter((x) => x.m > 0).map((x) => (
                    <i key={x.s.id} style={{ height: `${(x.m / max) * 100}%`, background: x.s.color }} />
                  ))}
                </div>
                <div className="lbl">{b.label}</div>
              </button>
            );
          })}
        </div>
        <div className="chart-legend">
          {state.subjects.map((s) => <span key={s.id}><Dot color={s.color} /> {s.name}</span>)}
          <span className="muted push-right">In view {fmt(total)} · avg {fmt(total / bs.length)} / {unit}</span>
        </div>

        <div className="period-detail" key={`${period}-${sel}`}>
          <div className="pd-head">
            <div>
              <div className="muted small-text">{cur.title}</div>
              <div className="pd-total">{fmt(cur.total)}</div>
            </div>
            <span className={`pd-diff ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}`}>
              {diff === 0 ? `Same as previous ${unit}` : `${diff > 0 ? '▲' : '▼'} ${fmt(Math.abs(diff))}${pct != null ? ` (${diff > 0 ? '+' : ''}${pct}%)` : ''} vs previous ${unit}`}
            </span>
          </div>
          {cur.total === 0 ? (
            <p className="muted small-text">Nothing logged in this {unit}.</p>
          ) : (
            <div className="pd-rows">
              {cur.per.filter((x) => x.m > 0).sort((a, b) => b.m - a.m).map((x) => (
                <div key={x.s.id} className="pd-row">
                  <span className="pd-name"><Dot color={x.s.color} /> {x.s.name}</span>
                  <b>{fmt(x.m)}</b>
                  <span className="muted pd-share">{Math.round((x.m / cur.total) * 100)}%</span>
                  <Bar pct={(x.m / cur.total) * 100} color={x.s.color} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
