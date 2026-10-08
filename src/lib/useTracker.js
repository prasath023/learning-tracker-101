import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { addDays, dkey, sod } from './dates';
import { defaultState, makeTopics, PALETTE, uid } from './defaults';
import { db } from './firebase';
import { entry } from './stats';

const SAVE_DELAY = 300;

const isValidState = (s) => s && Array.isArray(s.subjects) && s.logs && typeof s.logs === 'object';

const parseState = (json) => {
  try {
    const s = JSON.parse(json);
    return isValidState(s) ? { ...defaultState(), ...s } : null;
  } catch {
    return null;
  }
};


/* ---- draft mutators (operate on a cloned state) ---- */
function setEntry(d, k, sid, patch) {
  const e = { ...entry(d, k, sid), ...patch };
  e.min = Math.max(0, Math.round((e.min || 0) * 100) / 100);
  d.logs[k] ??= {};
  if (!e.min && !e.done) delete d.logs[k][sid];
  else d.logs[k][sid] = e;
  if (!Object.keys(d.logs[k]).length) delete d.logs[k];
}

/**
 * Timer shape: { sid, start, acc }
 *   start — when the current running stretch began (null while paused)
 *   acc   — ms already logged earlier in this session (for the on-screen clock)
 * Time is written to the log on every pause/stop, so paused time never counts.
 */
export const timerElapsed = (t, now = Date.now()) => (t ? (t.acc || 0) + (t.start ? now - t.start : 0) : 0);

/** Log the current running stretch (split across midnight if needed) and leave the timer paused. */
function commitTimer(d) {
  const t = d.timer;
  if (!t?.start) return;
  let s = new Date(t.start);
  const end = new Date();
  while (s < end) {
    const next = addDays(sod(s), 1);
    const segEnd = next < end ? next : end;
    const m = (segEnd - s) / 60000;
    if (m > 0 && d.subjects.some((x) => x.id === t.sid)) {
      setEntry(d, dkey(s), t.sid, { min: entry(d, dkey(s), t.sid).min + m });
    }
    s = segEnd;
  }
  t.acc = (t.acc || 0) + (end - t.start);
  t.start = null;
}

function closeTimer(d) {
  commitTimer(d);
  d.timer = null;
}

/**
 * The whole tracker state for one user, stored in Firestore at users/{uid} as a JSON string
 * (a string keeps us clear of Firestore's per-field limits and undefined-value errors).
 * Returns [state | null while loading, actions, syncError].
 */
export function useTracker(userId) {
  const [state, setState] = useState(null);
  const [syncError, setSyncError] = useState(null);
  const lastJson = useRef(null); // last JSON we saved or received — used to skip echoes
  const pending = useRef(null); // JSON waiting for the debounced save
  const inFlight = useRef(new Set()); // JSON we've sent whose server echo hasn't come back yet
  const ref = useMemo(() => doc(db, 'users', userId), [userId]);

  const write = useCallback((json) => {
    pending.current = null;
    inFlight.current.add(json);
    return setDoc(ref, { data: json, updatedAt: serverTimestamp() })
      .then(() => { setSyncError(null); return true; })
      .catch((e) => { inFlight.current.delete(json); setSyncError(e.message); return false; });
  }, [ref]);

  // load + live updates (other tabs / devices)
  useEffect(() => {
    return onSnapshot(ref, { includeMetadataChanges: false }, (snap) => {
      if (snap.metadata.hasPendingWrites) return; // our own write echoing back
      if (!snap.exists()) {
        // Only trust "doesn't exist" from the server, never from an empty offline cache,
        // otherwise we could overwrite real data with a fresh default.
        if (snap.metadata.fromCache) return;
        const s = defaultState(); // first login: start fresh
        lastJson.current = JSON.stringify(s);
        setState(s);
        write(lastJson.current);
        return;
      }
      const json = snap.data().data;
      // The server confirming one of our own saves. Ignore it: by now the user may have
      // made newer changes, and applying this older copy would undo them.
      if (inFlight.current.has(json)) {
        // also drop older saves the server may have folded into this one (Set keeps send order)
        for (const sent of inFlight.current) {
          inFlight.current.delete(sent);
          if (sent === json) break;
        }
        return;
      }
      // Unsaved local edits always win; they'll be written in a moment anyway.
      if (pending.current || inFlight.current.size) return;
      if (json === lastJson.current) return;
      const s = parseState(json);
      if (s) {
        lastJson.current = json;
        setState(s);
      }
    }, (e) => setSyncError(e.message));
  }, [ref, write]);

  // debounced save on every change
  useEffect(() => {
    if (!state) return;
    const json = JSON.stringify(state);
    if (json === lastJson.current) return;
    lastJson.current = json;
    pending.current = json;
    const h = setTimeout(() => write(json), SAVE_DELAY);
    return () => clearTimeout(h);
  }, [state, write]);

  // don't lose the last edit when the tab is hidden/closed or the user logs out
  const flush = useCallback(() => (pending.current ? write(pending.current) : Promise.resolve()), [write]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const update = useCallback((fn) => {
    setState((prev) => {
      const d = structuredClone(prev);
      fn(d);
      return d;
    });
  }, []);

  const actions = useMemo(() => ({
    startTimer: (sid) => update((d) => { closeTimer(d); d.timer = { sid, start: Date.now(), acc: 0 }; }),
    pauseTimer: () => update(commitTimer),
    resumeTimer: () => update((d) => { if (d.timer && !d.timer.start) d.timer.start = Date.now(); }),
    stopTimer: () => update(closeTimer),
    addMinutes: (k, sid, m) => update((d) => setEntry(d, k, sid, { min: entry(d, k, sid).min + m })),
    toggleDone: (k, sid) => update((d) => setEntry(d, k, sid, { done: !entry(d, k, sid).done })),

    saveDay: (k, rows, note) => update((d) => {
      for (const { sid, min, done } of rows) {
        const old = entry(d, k, sid).min;
        // keep fractional timer minutes if the user didn't change the rounded value
        setEntry(d, k, sid, { min: Math.round(old) === min ? old : min, done });
      }
      if (note) d.notes[k] = note;
      else delete d.notes[k];
    }),

    addSubject: ({ name, color, goal, topics }) => update((d) => {
      const id = uid();
      d.subjects.push({ id, name, color: color || PALETTE[d.subjects.length % PALETTE.length], goal: goal || 30 });
      d.topics[id] = makeTopics(topics || []);
      d.ui.topicTab = id;
    }),
    editSubject: (id, patch) => update((d) => {
      const s = d.subjects.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    }),
    deleteSubject: (id) => update((d) => {
      if (d.timer?.sid === id) d.timer = null;
      d.subjects = d.subjects.filter((x) => x.id !== id);
      delete d.topics[id];
      for (const k in d.logs) {
        delete d.logs[k][id];
        if (!Object.keys(d.logs[k]).length) delete d.logs[k];
      }
      d.schedule = (d.schedule || []).filter((b) => b.sid !== id);
      if (d.ui.topicTab === id) d.ui.topicTab = d.subjects[0]?.id;
    }),
    moveSubject: (id, dir) => update((d) => {
      const i = d.subjects.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.subjects.length) return;
      [d.subjects[i], d.subjects[j]] = [d.subjects[j], d.subjects[i]];
    }),

    addTopic: (sid, text) => update((d) => { (d.topics[sid] ??= []).push({ id: uid(), text, done: false }); }),
    toggleTopic: (sid, id) => update((d) => {
      const t = d.topics[sid]?.find((x) => x.id === id);
      if (t) {
        t.done = !t.done;
        t.doneAt = t.done ? dkey(new Date()) : undefined;
      }
    }),
    deleteTopic: (sid, id) => update((d) => { d.topics[sid] = (d.topics[sid] || []).filter((x) => x.id !== id); }),

    // schedule blocks: { id, sid, days: [0-6, 0 = Sunday], start: 'HH:MM', end: 'HH:MM' }
    addBlock: (block) => update((d) => { (d.schedule ??= []).push({ ...block, id: uid() }); }),
    editBlock: (id, patch) => update((d) => {
      const b = d.schedule?.find((x) => x.id === id);
      if (b) Object.assign(b, patch);
    }),
    deleteBlock: (id) => update((d) => { d.schedule = (d.schedule || []).filter((x) => x.id !== id); }),

    setUi: (patch) => update((d) => { Object.assign(d.ui, patch); }),

    /** Wipe one day's time, ticks and notes, discard any timer session, and untick topics completed that day. */
    clearDay: (k) => update((d) => {
      d.timer = null;
      delete d.logs[k];
      delete d.notes[k];
      for (const list of Object.values(d.topics)) {
        for (const t of list) {
          if (t.doneAt === k) {
            t.done = false;
            delete t.doneAt;
          }
        }
      }
    }),
    reset: () => setState(defaultState()),
    flush,
  }), [update, flush]);

  return [state, actions, syncError];
}

/** Current time that ticks every `ms` — used for live timer totals. */
export function useNow(ms, enabled = true) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const h = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(h);
  }, [ms, enabled]);
  return now;
}
