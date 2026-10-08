import { useState } from 'react';
import { Bar, SlidingTabs } from './ui';

export default function Topics({ state, stats, actions }) {
  const [text, setText] = useState('');
  const sid = stats.subj(state.ui.topicTab) ? state.ui.topicTab : state.subjects[0]?.id;
  const s = stats.subj(sid);
  const list = state.topics[sid] || [];
  const p = stats.topicProgress(sid);

  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    actions.addTopic(sid, text.trim());
    setText('');
  };

  return (
    <section>
      <h2>Topics roadmap</h2>
      <div className="card">
        <SlidingTabs
          className="subject-tabs"
          label="Subjects"
          items={state.subjects.map((x) => {
            const tp = stats.topicProgress(x.id);
            return { id: x.id, label: x.name, extra: `${tp.done}/${tp.total}`, color: x.color };
          })}
          value={sid}
          onChange={(id) => actions.setUi({ topicTab: id })}
        />
        {s && (
          <>
            <Bar pct={p.total ? (p.done / p.total) * 100 : 0} color={s.color} />
            {list.length === 0 && <p className="muted">No topics yet — add the things you plan to cover.</p>}
            <ul className="topics">
              {list.map((t) => (
                <li key={t.id} className={t.done ? 'done' : ''}>
                  <input type="checkbox" checked={t.done} onChange={() => actions.toggleTopic(sid, t.id)} />
                  <span>
                    {t.text}
                    {t.doneAt && <small className="muted"> · {t.doneAt}</small>}
                  </span>
                  <button className="x" title="Remove" onClick={() => actions.deleteTopic(sid, t.id)}>✕</button>
                </li>
              ))}
            </ul>
            <form className="row add-topic" onSubmit={add}>
              <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Add a topic to ${s.name}…`} />
              <button className="primary">Add</button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
