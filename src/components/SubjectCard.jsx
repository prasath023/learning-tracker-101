import { dkey, fmt, mondayOf, monthStart, addDays, sod } from '../lib/dates';
import { entry } from '../lib/stats';
import { Bar, Dot, Icon, Ring, TimerClock } from './ui';

const QUICK = [[15, '15m'], [30, '30m'], [60, '1h']];

/** "DSA" → "DSA", "System Design" → "SD", "English Speaking" → "ES" */
const initials = (name) => {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, words[0].length <= 4 ? 4 : 2).toUpperCase();
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

export default function SubjectCard({ s, state, stats, now, actions, onEditDay }) {
  const tk = dkey(new Date(now));
  const today = stats.minutesOn(tk, s.id);
  const e = entry(state, tk, s.id);
  const tp = stats.topicProgress(s.id);
  const active = state.timer?.sid === s.id;
  const paused = active && !state.timer.start;
  const end = addDays(sod(new Date(now)), 1);
  const goal = s.goal || 60;
  const streak = stats.streak(s.id);

  return (
    <div className={`card scard ${active ? 'running' : ''} ${paused ? 'paused' : ''}`} style={{ '--c': s.color }}>
      <div className="sc-head">
        <span className="name" title={s.name} data-initials={initials(s.name)}><Dot color={s.color} /><span className="name-text">{s.name}</span></span>
        <span className={`sc-streak ${streak ? 'hot' : ''}`} title="Current streak (days)">🔥 {streak}</span>
        <button className="icon-btn" onClick={() => onEditDay(tk)} title="Edit today's log" aria-label={`Edit today's log for ${s.name}`}>
          <Icon name="pencil" size={15} />
        </button>
      </div>

      <div className="sc-body">
        <Ring pct={(today / goal) * 100}>
          <b>{fmt(today)}</b>
          <span>of {fmt(goal)}</span>
        </Ring>
        <div className="sc-stats">
          <div><span>Week</span><b>{fmt(stats.minutesRange(mondayOf(new Date(now)), end, s.id))}</b></div>
          <div><span>Month</span><b>{fmt(stats.minutesRange(monthStart(new Date(now)), end, s.id))}</b></div>
          <div>
            <span>Topics</span><b>{tp.done}/{tp.total}</b>
            <Bar pct={tp.total ? (tp.done / tp.total) * 100 : 0} />
          </div>
        </div>
      </div>

      <div className="sc-actions">
        {active ? (
          <>
            <span className="clock"><i className="clock-dot" /><TimerClock timer={state.timer} /></span>
            {paused ? (
              <button className="icon-btn tinted" onClick={actions.resumeTimer} title="Resume" aria-label="Resume"><Icon name="play" /></button>
            ) : (
              <button className="icon-btn" onClick={actions.pauseTimer} title="Pause" aria-label="Pause"><Icon name="pause" /></button>
            )}
            <button className="icon-btn stop" onClick={actions.stopTimer} title="Stop" aria-label="Stop"><Icon name="stop" size={14} /></button>
          </>
        ) : (
          <button className="sc-start" onClick={() => actions.startTimer(s.id)}>
            <Icon name="play" size={14} /> Start
          </button>
        )}
        <button
          className={`sc-done ${e.done ? 'on' : ''} ${active ? 'compact' : ''}`}
          onClick={() => actions.toggleDone(tk, s.id)}
          aria-pressed={e.done}
          aria-label={e.done ? 'Done today (tap to undo)' : 'Mark today as done'}
          title={e.done ? 'Marked done today — tap to undo' : 'Mark today as done'}
        >
          <Icon name="check" size={15} />{!active && ' Done'}
        </button>
      </div>

      <div className="sc-quick" role="group" aria-label="Quick add time">
        <span className="sc-quick-label"><Icon name="clock" size={14} /></span>
        {QUICK.map(([m, label]) => (
          <button key={m} onClick={() => actions.addMinutes(tk, s.id, m)} title={`Add ${label} to today`}>+{label}</button>
        ))}
      </div>
    </div>
  );
}
