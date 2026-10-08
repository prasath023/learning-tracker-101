import { useEffect, useRef, useState } from 'react';
import { DAYS, dkey, fmt } from '../lib/dates';
import { Dot, Modal } from './ui';

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun
const HOUR_PX = 44;
const PRESETS = [
  ['Weekdays', [1, 2, 3, 4, 5]],
  ['Weekend', [0, 6]],
  ['Every day', [0, 1, 2, 3, 4, 5, 6]],
];

const pad = (n) => String(n).padStart(2, '0');
const toMin = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
/** '13:30' → '1:30 PM' */
function time12(t) {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}${m ? `:${pad(m)}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}
/** An end time at or before the start time means the block runs past midnight (e.g. 10 PM – 1 AM). */
const isOvernight = (b) => toMin(b.end) <= toMin(b.start);
const duration = (b) => (toMin(b.end) - toMin(b.start) + 1440) % 1440;

/**
 * Split blocks into per-day pieces { b, day, s, e } in minutes since midnight.
 * An overnight block becomes start→midnight on its day plus midnight→end on the next day.
 */
function segments(blocks) {
  const out = [];
  for (const b of blocks) {
    const s = toMin(b.start);
    const e = toMin(b.end);
    for (const day of b.days) {
      if (e > s) {
        out.push({ b, day, s, e });
      } else {
        out.push({ b, day, s, e: 1440 });
        if (e > 0) out.push({ b, day: (day + 1) % 7, s: 0, e, cont: true });
      }
    }
  }
  return out;
}
const segOverlap = (x, y) => x.day === y.day && x.s < y.e && y.s < x.e;

/** Assign side-by-side lanes to segments that overlap; non-overlapping groups keep full width. */
function layoutDay(segs) {
  const sorted = [...segs].sort((a, b) => a.s - b.s);
  const out = [];
  let cluster = [];
  let laneEnds = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) out.push({ ...p, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };
  for (const seg of sorted) {
    if (seg.s >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= seg.s);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = seg.e;
    clusterEnd = Math.max(clusterEnd, seg.e);
    cluster.push({ seg, lane });
  }
  flush();
  return out;
}

/** Browser notification when a scheduled block starts (only while this tab is open). */
function useReminders(blocks, subjName, enabled) {
  const fired = useRef(new Set());
  useEffect(() => {
    if (!enabled || !('Notification' in window)) return;
    const check = () => {
      if (Notification.permission !== 'granted') return;
      const d = new Date();
      const m = d.getHours() * 60 + d.getMinutes();
      for (const b of blocks) {
        const key = `${dkey(d)}-${b.id}-${b.start}`;
        if (b.days.includes(d.getDay()) && toMin(b.start) === m && !fired.current.has(key)) {
          fired.current.add(key);
          new Notification(`Time for ${subjName(b.sid)} 📚`, { body: `${time12(b.start)} – ${time12(b.end)}` });
        }
      }
    };
    check();
    const h = setInterval(check, 15000);
    return () => clearInterval(h);
  }, [blocks, subjName, enabled]);
}

/** Today's blocks with now/next/past status and a Start button for the current one. */
export function TodayPlan({ state, stats, now, actions, showWeekly = false }) {
  const blocks = (state.schedule || []).filter((b) => stats.subj(b.sid));
  const d = new Date(now);
  const dow = d.getDay();
  const nowMin = d.getHours() * 60 + d.getMinutes();
  const tk = dkey(d);
  const today = segments(blocks).filter((x) => x.day === dow).sort((a, b) => a.s - b.s);
  const plannedToday = today.reduce((a, x) => a + x.e - x.s, 0);
  const weekly = state.subjects
    .map((s) => ({ s, min: blocks.filter((b) => b.sid === s.id).reduce((a, b) => a + duration(b) * b.days.length, 0) }))
    .filter((x) => x.min > 0);

  return (
    <div className="card today-plan">
      <div className="kv"><b>Today's plan</b><span className="muted">{fmt(plannedToday)} planned</span></div>
      {today.length === 0 && <p className="muted">Nothing scheduled today. Add blocks in the Schedule tab.</p>}
      {today.map(({ b, s: from, e: to, cont }) => {
        const s = stats.subj(b.sid);
        const st = nowMin >= to ? 'past' : nowMin >= from ? 'now' : 'next';
        const running = state.timer?.sid === b.sid && !!state.timer.start;
        const paused = state.timer?.sid === b.sid && !state.timer.start;
        const when = cont ? `until ${time12(b.end)} (from last night)` : `${time12(b.start)} – ${time12(b.end)}${isOvernight(b) ? ' (next day)' : ''}`;
        return (
          <div key={b.id + (cont ? '-c' : '')} className={`plan-row ${st}`} style={{ '--c': s.color }}>
            <div>
              <div className="plan-name"><Dot color={s.color} /> {s.name}</div>
              <div className="muted small-text">{when} · logged today {fmt(stats.minutesOn(tk, s.id))}</div>
            </div>
            {st === 'now' && (running
              ? <span className="chip live">● Studying</span>
              : paused
                ? <button className="small primary" onClick={actions.resumeTimer}>▶ Resume</button>
                : <button className="small primary" onClick={() => actions.startTimer(b.sid)}>▶ Start</button>)}
            {st === 'next' && <span className="chip">in {fmt(from - nowMin)}</span>}
            {st === 'past' && <span className="chip muted">{stats.minutesOn(tk, s.id) > 0 ? '✓' : 'missed?'}</span>}
          </div>
        );
      })}
      {showWeekly && weekly.length > 0 && (
        <div className="weekly-plan">
          <div className="muted small-text">Planned per week</div>
          {weekly.map(({ s, min }) => (
            <div key={s.id} className="kv"><span><Dot color={s.color} /> {s.name}</span><span>{fmt(min)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Browser reminders for scheduled blocks — mounted at the app level so they fire on any tab. */
export function ScheduleReminders({ state, stats }) {
  const blocks = (state.schedule || []).filter((b) => stats.subj(b.sid));
  useReminders(blocks, (sid) => stats.subj(sid)?.name, state.ui.reminders);
  return null;
}

export default function Schedule({ state, stats, now, actions }) {
  const [dlg, setDlg] = useState(null); // { block } to edit, or { draft } to create
  const blocks = (state.schedule || []).filter((b) => stats.subj(b.sid));
  const d = new Date(now);
  const dow = d.getDay();
  const nowMin = d.getHours() * 60 + d.getMinutes();

  const view = state.ui.schedView || 'list';
  const segs = segments(blocks);
  const nowIds = new Set(segs.filter((x) => x.day === dow && nowMin >= x.s && nowMin < x.e).map((x) => x.b.id));
  const startHour = Math.min(6, ...segs.map((x) => Math.floor(x.s / 60)));
  const endHour = Math.min(24, Math.max(23, ...segs.map((x) => Math.ceil(x.e / 60))));
  const hours = endHour - startHour;
  const y = (min) => ((min - startHour * 60) / 60) * HOUR_PX;

  const toggleReminders = async () => {
    if (state.ui.reminders) return actions.setUi({ reminders: false });
    if (!('Notification' in window)) return alert('This browser does not support notifications.');
    const perm = await Notification.requestPermission();
    if (perm === 'granted') actions.setUi({ reminders: true });
    else alert('Notifications are blocked for this site. Allow them in your browser settings to get reminders.');
  };

  const newAt = (day, hour) => {
    const start = Math.min(hour * 60, 23 * 60);
    setDlg({ draft: { sid: state.subjects[0]?.id, days: [day], start: fromMin(start), end: fromMin(Math.min(start + 60, 23 * 60 + 59)) } });
  };

  return (
    <section>
      <h2>
        Study schedule
        <span className="seg">
          {[['list', 'List'], ['timeline', 'Timeline']].map(([v, label]) => (
            <button key={v} className={view === v ? 'on' : ''} onClick={() => actions.setUi({ schedView: v })}>{label}</button>
          ))}
        </span>
        <button className="small" onClick={() => newAt(dow, Math.max(d.getHours() + 1, 6))}>+ Add time block</button>
        <button className={`small ${state.ui.reminders ? 'on' : ''}`} onClick={toggleReminders} title="Notify me when a block starts (while this tab is open)">
          🔔 Reminders {state.ui.reminders ? 'on' : 'off'}
        </button>
      </h2>

      <div className="sched-wrap">
        <TodayPlan state={state} stats={stats} now={now} actions={actions} showWeekly />

        {view === 'list' ? (
          <div className="week-list">
            {DAY_ORDER.map((day) => {
              const list = blocks.filter((b) => b.days.includes(day)).sort((a, b) => toMin(a.start) - toMin(b.start));
              const total = list.reduce((a, b) => a + duration(b), 0);
              return (
                <div key={day} className={`card day-list ${day === dow ? 'today' : ''}`}>
                  <div className="day-list-head">
                    <b>{DAYS[day]}</b>
                    <span className="muted small-text">{total ? fmt(total) : ''}</span>
                  </div>
                  {list.length === 0 && <div className="muted small-text free">Free</div>}
                  {list.map((b) => {
                    const s = stats.subj(b.sid);
                    return (
                      <button
                        key={b.id}
                        className={`slot ${day === dow && nowIds.has(b.id) ? 'now' : ''}`}
                        style={{ '--c': s.color }}
                        onClick={() => setDlg({ block: b })}
                        title="Click to edit"
                      >
                        <b>{s.name}</b>
                        <span>{time12(b.start)} – {time12(b.end)}{isOvernight(b) ? ' ⁺¹' : ''}</span>
                      </button>
                    );
                  })}
                  <button
                    className="small link add-slot"
                    onClick={() => newAt(day, list.length ? Math.ceil(toMin(list[list.length - 1].end) / 60) : 10)}
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="card sched-scroll">
          <div className="sched" style={{ gridTemplateRows: `auto ${hours * HOUR_PX}px` }}>
            <div />
            {DAY_ORDER.map((day) => (
              <div key={day} className={`sched-head ${day === dow ? 'today' : ''}`}>{DAYS[day]}</div>
            ))}
            <div className="sched-times">
              {Array.from({ length: hours }, (_, i) => (
                <span key={i} style={{ top: i * HOUR_PX }}>{time12(fromMin((startHour + i) * 60))}</span>
              ))}
            </div>
            {DAY_ORDER.map((day) => (
              <div
                key={day}
                className={`sched-col ${day === dow ? 'today' : ''}`}
                style={{ backgroundSize: `100% ${HOUR_PX}px` }}
                onClick={(e) => {
                  if (e.target !== e.currentTarget) return;
                  newAt(day, startHour + Math.floor(e.nativeEvent.offsetY / HOUR_PX));
                }}
              >
                {layoutDay(segs.filter((x) => x.day === day)).map(({ seg, lane, lanes }) => {
                  const { b } = seg;
                  const s = stats.subj(b.sid);
                  const short = seg.e - seg.s < 45;
                  return (
                    <div
                      key={b.id + (seg.cont ? '-c' : '')}
                      className={`sched-block ${short ? 'short' : ''} ${day === dow && nowMin >= seg.s && nowMin < seg.e ? 'now' : ''}`}
                      style={{
                        '--c': s.color,
                        top: y(seg.s),
                        height: Math.max(18, y(seg.e) - y(seg.s) - 2),
                        left: `calc(${(lane / lanes) * 100}% + 2px)`,
                        width: `calc(${100 / lanes}% - 4px)`,
                      }}
                      data-tip={`${s.name}\n${time12(b.start)} – ${time12(b.end)} (${fmt(duration(b))})\nClick to edit`}
                      onClick={() => setDlg({ block: b })}
                    >
                      <b>{s.name}</b>
                      {!short && <span>{time12(b.start)} – {time12(b.end)}</span>}
                    </div>
                  );
                })}
                {day === dow && nowMin >= startHour * 60 && nowMin < endHour * 60 && (
                  <div className="now-line" style={{ top: y(nowMin) }} />
                )}
              </div>
            ))}
          </div>
        </div>
        )}
      </div>

      {dlg && (
        <BlockDialog
          block={dlg.block}
          draft={dlg.draft}
          state={state}
          stats={stats}
          actions={actions}
          onClose={() => setDlg(null)}
        />
      )}
    </section>
  );
}

function BlockDialog({ block, draft, state, stats, actions, onClose }) {
  const init = block || draft;
  const [sid, setSid] = useState(init.sid);
  const [start, setStart] = useState(init.start);
  const [end, setEnd] = useState(init.end);
  const [days, setDays] = useState(init.days);

  const toggleDay = (day) => setDays((ds) => (ds.includes(day) ? ds.filter((x) => x !== day) : [...ds, day]));
  const error = !sid ? 'Pick a subject.' : !days.length ? 'Pick at least one day.' : start === end ? 'Start and end time can\'t be the same.' : '';

  const mine = segments([{ start, end, days }]);
  const conflicts = error ? [] : (state.schedule || []).filter(
    (b) => b.id !== block?.id && stats.subj(b.sid) && segments([b]).some((x) => mine.some((m) => segOverlap(x, m))),
  );

  const save = () => {
    if (error) return;
    const data = { sid, start, end, days: [...days].sort() };
    if (block) actions.editBlock(block.id, data);
    else actions.addBlock(data);
    onClose();
  };

  return (
    <Modal
      title={block ? 'Edit time block' : 'New time block'}
      onClose={onClose}
      footer={
        <>
          {block && (
            <button className="danger push-left" onClick={() => { actions.deleteBlock(block.id); onClose(); }}>Delete</button>
          )}
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save} disabled={!!error}>Save</button>
        </>
      }
    >
      <div className="form">
        <label>Subject
          <div className="row">
            {state.subjects.map((s) => (
              <button type="button" key={s.id} className={`small subj-pick ${s.id === sid ? 'on' : ''}`} style={{ '--c': s.color }} onClick={() => setSid(s.id)}>
                <Dot color={s.color} /> {s.name}
              </button>
            ))}
          </div>
        </label>
        <div className="form-row">
          <label>From <input type="time" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} /></label>
          <label>To <input type="time" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} /></label>
          {!error && (
            <span className="muted small-text duration">
              {fmt(duration({ start, end }))}{isOvernight({ start, end }) ? ' · ends next day' : ''}
            </span>
          )}
        </div>
        <label>Repeat on
          <div className="row">
            {DAY_ORDER.map((day) => (
              <button type="button" key={day} className={`small day-pick ${days.includes(day) ? 'on' : ''}`} onClick={() => toggleDay(day)}>
                {DAYS[day]}
              </button>
            ))}
          </div>
          <div className="row">
            {PRESETS.map(([label, ds]) => (
              <button type="button" key={label} className="small link" onClick={() => setDays(ds)}>{label}</button>
            ))}
          </div>
        </label>
        {error && <p className="error">{error}</p>}
        {conflicts.length > 0 && (
          <p className="warn">
            ⚠ Overlaps with{' '}
            {conflicts.map((b) => `${stats.subj(b.sid).name} ${time12(b.start)}–${time12(b.end)}`).join(', ')}. You can still save.
          </p>
        )}
      </div>
    </Modal>
  );
}
