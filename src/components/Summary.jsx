import { addDays, dkey, fmt, mondayOf, monthStart, sod } from '../lib/dates';
import { Bar, Dot } from './ui';

export default function Summary({ state, stats, now }) {
  const d = new Date(now);
  const tk = dkey(d);
  const end = addDays(sod(d), 1);
  const rows = state.subjects.map((s) => ({
    s,
    today: stats.minutesOn(tk, s.id),
    week: stats.minutesRange(mondayOf(d), end, s.id),
    month: stats.minutesRange(monthStart(d), end, s.id),
    all: stats.allTime(s.id),
    cur: stats.streak(s.id),
    best: stats.longestStreak(s.id),
  }));
  const sum = (f) => rows.reduce((a, r) => a + r[f], 0);
  const allSum = sum('all') || 1;

  return (
    <section>
      <h2>Summary</h2>
      <div className="card tbl-scroll">
        <table>
          <thead>
            <tr>
              <th>Subject</th><th>Today</th><th>This week</th><th>This month</th><th>All time</th>
              <th>Share</th><th>Daily goal</th><th>Streak (best)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.s.id}>
                <td><Dot color={r.s.color} /> {r.s.name}</td>
                <td>{fmt(r.today)}</td><td>{fmt(r.week)}</td><td>{fmt(r.month)}</td><td>{fmt(r.all)}</td>
                <td className="share"><Bar pct={(r.all / allSum) * 100} color={r.s.color} /></td>
                <td>{fmt(r.s.goal)}</td>
                <td>{r.cur} ({r.best})</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td><td>{fmt(sum('today'))}</td><td>{fmt(sum('week'))}</td><td>{fmt(sum('month'))}</td>
              <td>{fmt(sum('all'))}</td><td />
              <td>{fmt(state.subjects.reduce((a, s) => a + s.goal, 0))}</td>
              <td>{stats.streak()} ({stats.longestStreak()})</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
