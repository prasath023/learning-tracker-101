import { addDays, dkey, parseKey, sod } from './dates';

const EMPTY = { min: 0, done: false };

export const entry = (S, k, sid) => S.logs[k]?.[sid] ?? EMPTY;

/**
 * Read-only queries over the state. `now` (ms) lets a running timer count
 * towards today's totals so numbers feel live.
 */
export function makeStats(S, now) {
  const subj = (id) => S.subjects.find((s) => s.id === id);

  function liveMinutes(k, sid) {
    const t = S.timer;
    if (!t?.start || (sid && t.sid !== sid)) return 0; // paused time is already in the log
    const dayStart = +parseKey(k);
    const dayEnd = +addDays(parseKey(k), 1);
    const from = Math.max(t.start, dayStart);
    const to = Math.min(now, dayEnd);
    return to > from ? (to - from) / 60000 : 0;
  }

  function minutesOn(k, sid) {
    if (sid) return entry(S, k, sid).min + liveMinutes(k, sid);
    return S.subjects.reduce((a, s) => a + minutesOn(k, s.id), 0);
  }

  function minutesRange(from, toExcl, sid) {
    const end = Math.min(+toExcl, +addDays(sod(new Date(now)), 1));
    let total = 0;
    for (let d = sod(from); +d < end; d = addDays(d, 1)) total += minutesOn(dkey(d), sid);
    return total;
  }

  function allTime(sid) {
    let t = 0;
    for (const s of sid ? [subj(sid)] : S.subjects) {
      for (const k in S.logs) t += entry(S, k, s.id).min;
      t += liveMinutes(dkey(new Date(now)), s.id);
    }
    return t;
  }

  function active(k, sid) {
    if (sid) {
      const e = entry(S, k, sid);
      return e.min > 0 || e.done || liveMinutes(k, sid) > 0;
    }
    return S.subjects.some((s) => active(k, s.id));
  }

  function streak(sid) {
    let d = sod(new Date(now));
    if (!active(dkey(d), sid)) d = addDays(d, -1);
    let n = 0;
    while (active(dkey(d), sid)) {
      n++;
      d = addDays(d, -1);
    }
    return n;
  }

  function longestStreak(sid) {
    const keys = Object.keys(S.logs).sort();
    if (!keys.length) return streak(sid);
    let best = 0;
    let cur = 0;
    const end = addDays(sod(new Date(now)), 1);
    for (let d = parseKey(keys[0]); d < end; d = addDays(d, 1)) {
      if (active(dkey(d), sid)) best = Math.max(best, ++cur);
      else cur = 0;
    }
    return best;
  }

  /** 0–4 heatmap intensity. Level 4 = daily goal reached; a "done" tick is at least level 2. */
  function level(k, sid) {
    let min, goal, done;
    if (sid) {
      min = minutesOn(k, sid);
      goal = subj(sid)?.goal || 60;
      done = entry(S, k, sid).done;
    } else {
      min = minutesOn(k);
      goal = S.subjects.reduce((a, s) => a + (s.goal || 60), 0) || 60;
      done = S.subjects.some((s) => entry(S, k, s.id).done);
    }
    if (!min && !done) return 0;
    const r = min / goal;
    let l = r >= 1 ? 4 : r >= 0.5 ? 3 : r >= 0.25 ? 2 : 1;
    if (done) l = Math.max(l, 2);
    return l;
  }

  function topicProgress(sid) {
    const list = S.topics[sid] || [];
    return { done: list.filter((t) => t.done).length, total: list.length };
  }

  return { subj, minutesOn, minutesRange, allTime, active, streak, longestStreak, level, topicProgress };
}
