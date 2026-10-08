import { useLayoutEffect, useRef } from 'react';
import { addDays, dkey, fmt, mondayOf, MONTHS, niceDate, sod } from '../lib/dates';
import { entry } from '../lib/stats';
import { Dot } from './ui';

/** LeetCode/GitHub-style year grid. `sid` = null shows all subjects combined. */
export default function Heatmap({ sid, state, stats, now, onDay }) {
  const scrollRef = useRef(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const today = sod(new Date(now));
  const tk = dkey(today);
  const start = addDays(mondayOf(today), -52 * 7);
  const s = sid ? stats.subj(sid) : null;
  const list = s ? [s] : state.subjects;

  const months = [];
  const cells = [];
  let lastMonth = -1;
  let activeDays = 0;
  let totalMin = 0;

  for (let w = 0; w < 53; w++) {
    const ws = addDays(start, w * 7);
    months.push(<span key={w}>{ws.getMonth() !== lastMonth ? MONTHS[ws.getMonth()] : ''}</span>);
    lastMonth = ws.getMonth();
    for (let d = 0; d < 7; d++) {
      const day = addDays(ws, d);
      const k = dkey(day);
      if (day > today) {
        cells.push(<div key={k} className="cell future" />);
        continue;
      }
      const l = stats.level(k, sid);
      const lines = [niceDate(day)];
      for (const x of list) {
        const m = stats.minutesOn(k, x.id);
        const done = entry(state, k, x.id).done;
        if (m || done) lines.push(`${x.name}: ${fmt(m)}${done ? ' ✓' : ''}`);
      }
      if (lines.length === 1) lines.push('No activity');
      if (!sid && state.notes[k]) lines.push(`📝 ${state.notes[k].slice(0, 80)}`);
      if (l) {
        activeDays++;
        totalMin += stats.minutesOn(k, sid);
      }
      cells.push(
        <div key={k} className={`cell l${l}${k === tk ? ' today' : ''}`} data-tip={lines.join('\n')} onClick={() => onDay(k)} />,
      );
    }
  }

  return (
    <div className="card hm-card">
      <div className="hm-head">
        <div className="t">{s ? <><Dot color={s.color} />{s.name}</> : 'All subjects'}</div>
        <div className="s">
          <span><b>{activeDays}</b> active days in the past year</span>
          <span>{fmt(totalMin)} total</span>
          <span>Streak {stats.streak(sid)} · best {stats.longestStreak(sid)}</span>
        </div>
      </div>
      <div className="hm-scroll" ref={scrollRef}>
        <div className="hm">
          <div />
          <div className="hm-months">{months}</div>
          <div className="hm-days"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
          <div className="hm-grid">{cells}</div>
        </div>
      </div>
      <div className="legend">
        Less <span className="cell" /><span className="cell l1" /><span className="cell l2" /><span className="cell l3" /><span className="cell l4" /> More
        <span className="legend-note">(darkest green = daily goal reached)</span>
      </div>
    </div>
  );
}
