import { useState } from 'react';
import { dkey } from '../lib/dates';
import { PALETTE, TOPIC_TEMPLATES } from '../lib/defaults';
import { entry } from '../lib/stats';
import { Dot, Modal } from './ui';

export function DayDialog({ initialKey, state, actions, onClose }) {
  const [todayK] = useState(() => dkey(new Date()));
  const [k, setK] = useState(initialKey || todayK);
  const rowsFor = (key) => Object.fromEntries(state.subjects.map((s) => {
    const e = entry(state, key, s.id);
    return [s.id, { min: Math.round(e.min), done: e.done }];
  }));
  const [rows, setRows] = useState(() => rowsFor(k));
  const [note, setNote] = useState(state.notes[k] || '');

  const changeDate = (key) => {
    if (!key) return;
    setK(key);
    setRows(rowsFor(key));
    setNote(state.notes[key] || '');
  };
  const setRow = (sid, patch) => setRows((r) => ({ ...r, [sid]: { ...r[sid], ...patch } }));
  const save = () => {
    actions.saveDay(k, state.subjects.map((s) => ({ sid: s.id, ...rows[s.id] })), note.trim());
    onClose();
  };

  return (
    <Modal
      title={<>Log for <input type="date" value={k} max={todayK} onChange={(e) => changeDate(e.target.value)} /></>}
      onClose={onClose}
      footer={<><button onClick={onClose}>Cancel</button><button className="primary" onClick={save}>Save</button></>}
    >
      {state.subjects.length === 0 && <p className="muted">Add a subject first.</p>}
      {state.subjects.map((s) => (
        <div key={s.id} className="drow">
          <span><Dot color={s.color} /> {s.name}</span>
          <label>
            <input type="number" min="0" step="5" value={rows[s.id].min}
              onChange={(e) => setRow(s.id, { min: Math.max(0, Number(e.target.value) || 0) })} /> min
          </label>
          <label className="chk">
            <input type="checkbox" checked={rows[s.id].done} onChange={(e) => setRow(s.id, { done: e.target.checked })} /> Done
          </label>
        </div>
      ))}
      <label className="muted field-label">Notes (what did you learn?)</label>
      <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}

/** Add a new subject, or edit an existing one when `subject` is passed. */
export function SubjectDialog({ subject, state, actions, onClose }) {
  const [name, setName] = useState(subject?.name || '');
  const [color, setColor] = useState(subject?.color || PALETTE[state.subjects.length % PALETTE.length]);
  const [goal, setGoal] = useState(subject?.goal || 30);
  const [topicsText, setTopicsText] = useState('');

  const template = Object.keys(TOPIC_TEMPLATES).find((t) => t.toLowerCase() === name.trim().toLowerCase());

  const save = (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    const data = { name: name.trim(), color, goal: Math.max(5, Number(goal) || 30) };
    if (subject) actions.editSubject(subject.id, data);
    else actions.addSubject({ ...data, topics: topicsText.split('\n').map((t) => t.trim()).filter(Boolean) });
    onClose();
  };

  return (
    <Modal
      title={subject ? `Edit ${subject.name}` : 'New subject'}
      onClose={onClose}
      footer={<><button onClick={onClose}>Cancel</button><button className="primary" onClick={save} disabled={!name.trim()}>{subject ? 'Save' : 'Create'}</button></>}
    >
      <form onSubmit={save} className="form">
        <label>Name
          <input type="text" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Kubernetes, Java, Mock interviews" />
        </label>
        <div className="form-row">
          <label>Color
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
          <label>Daily goal (minutes)
            <input type="number" min="5" step="5" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </label>
        </div>
        <div className="swatches">
          {PALETTE.map((c) => (
            <button type="button" key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
        {!subject && (
          <label>Topics to cover (optional, one per line)
            <textarea rows={5} value={topicsText} onChange={(e) => setTopicsText(e.target.value)} placeholder={'Topic 1\nTopic 2'} />
            {template && !topicsText && (
              <button type="button" className="small" onClick={() => setTopicsText(TOPIC_TEMPLATES[template].join('\n'))}>
                Use the suggested {template} roadmap
              </button>
            )}
          </label>
        )}
      </form>
    </Modal>
  );
}

export function SettingsDialog({ state, actions, onClose, onEditSubject }) {
  const del = (s) => {
    if (confirm(`Delete "${s.name}" with all its logged time and topics? This can't be undone.`)) actions.deleteSubject(s.id);
  };

  return (
    <Modal title="Subjects" onClose={onClose} footer={<button onClick={onClose}>Close</button>}>
      {state.subjects.map((s, i) => (
        <div key={s.id} className="srow">
          <span><Dot color={s.color} /> {s.name} <span className="muted">· {s.goal}m/day</span></span>
          <div className="row">
            <button className="small" disabled={i === 0} onClick={() => actions.moveSubject(s.id, -1)} title="Move up">↑</button>
            <button className="small" disabled={i === state.subjects.length - 1} onClick={() => actions.moveSubject(s.id, 1)} title="Move down">↓</button>
            <button className="small" onClick={() => onEditSubject(s)}>Edit</button>
            <button className="small danger" onClick={() => del(s)}>Delete</button>
          </div>
        </div>
      ))}
      <button className="small add-btn" onClick={() => onEditSubject(null)}>+ Add subject</button>

      <h3 className="section-gap">Danger zone</h3>
      <div className="row">
        <button className="danger" onClick={() => {
          const msg = "Clear today's data?\n\n• Time logged today and running/paused timer\n• Today's ✓ Done ticks and note\n• Topics ticked today become unticked\n\nSubjects, schedule and earlier days are kept.";
          if (confirm(msg)) { actions.clearDay(dkey(new Date())); onClose(); }
        }}>Clear today's data</button>
        <button className="danger" onClick={() => {
          if (confirm('Erase ALL your data (subjects, time, topics, schedule) and start fresh? This cannot be undone.')) { actions.reset(); onClose(); }
        }}>Reset everything</button>
      </div>
    </Modal>
  );
}
