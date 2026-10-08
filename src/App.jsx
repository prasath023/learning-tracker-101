import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { addDays, dkey, fmt, fmtClock, mondayOf, niceDate, sod } from './lib/dates';
import { makeStats } from './lib/stats';
import { timerElapsed, useNow, useTracker } from './lib/useTracker';
import SubjectCard from './components/SubjectCard';
import TimeChart from './components/TimeChart';
import Summary from './components/Summary';
import Heatmap from './components/Heatmap';
import Topics from './components/Topics';
import Schedule, { ScheduleReminders, TodayPlan } from './components/Schedule';
import { DayDialog, SettingsDialog, SubjectDialog } from './components/Dialogs';
import { applyTheme, currentTheme } from './lib/theme';
import { Brand, Icon, SlidingTabs, Splash, ThemeToggle, Tooltip } from './components/ui';
import FloatingTimer from './components/FloatingTimer';

const TABS = [
  ['dashboard', 'Dashboard'],
  ['schedule', 'Schedule'],
  ['progress', 'Progress'],
  ['topics', 'Topics'],
];
const tabFromHash = () => {
  const h = window.location.hash.slice(1);
  return TABS.some(([id]) => id === h) ? h : 'dashboard';
};

/** Current tab, kept in the URL hash so refresh and the back button work. */
function useTab() {
  const [tab, setTab] = useState(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const go = (id) => {
    if (id !== tab) window.location.hash = id === 'dashboard' ? '' : id;
    window.scrollTo({ top: 0 });
  };
  return [tab, go];
}

/** Main section switcher (pinned at the top on desktop, floating at the bottom on mobile). */
function TabsBar({ tab, onChange }) {
  return (
    <div className="tabs-wrap">
      <SlidingTabs
        className="tabs-bar"
        label="Sections"
        items={TABS.map(([id, label]) => ({ id, label }))}
        value={tab}
        onChange={onChange}
      />
    </div>
  );
}

export default function App({ user }) {
  const [state, actions, syncError] = useTracker(user.uid);
  if (!state) return <LoadingData user={user} error={syncError} />;
  return <Dashboard user={user} state={state} actions={actions} syncError={syncError} />;
}

function Dashboard({ user, state, actions, syncError }) {
  // Refresh live totals every 15s while a timer runs, otherwise once a minute (handles day rollover).
  const now = useNow(state.timer?.start ? 15000 : 60000);
  const stats = useMemo(() => makeStats(state, now), [state, now]);

  const [dayKey, setDayKey] = useState(null); // open DayDialog for this date
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subjectDlg, setSubjectDlg] = useState(undefined); // undefined = closed, null = new, object = edit
  const [menuOpen, setMenuOpen] = useState(false); // mobile header menu
  const [tab, goTab] = useTab();

  usePageTitle(state);
  useEffect(() => applyTheme(state.ui.theme), [state.ui.theme]);
  const theme = state.ui.theme || currentTheme();
  const toggleTheme = () => actions.setUi({ theme: theme === 'dark' ? 'light' : 'dark' });
  const who = user.displayName || user.email;

  const d = new Date(now);
  const tk = dkey(d);
  const activeDays = Object.keys(state.logs).filter((k) => stats.active(k)).length;
  const common = { state, stats, now, actions };

  return (
    <div className="wrap">
      <header>
        <div className="brand">
          <h1><Brand /></h1>
          <div className="sub">{niceDate(d)}</div>
        </div>
        {/* inline on desktop, dropdown behind the ☰ button on mobile */}
        {menuOpen && <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />}
        <nav className={`header-actions ${menuOpen ? 'open' : ''}`} onClick={(e) => e.target.closest('button') && setMenuOpen(false)}>
          <button onClick={() => setDayKey(tk)}>Log a day</button>
          <button onClick={() => setSettingsOpen(true)}>Subjects</button>
          <span className="user-chip" title={user.email}>
            <span className="avatar" aria-hidden>{who.trim()[0]?.toUpperCase()}</span>
            <span className="user-who">
              <span className="user-name">{who}</span>
              {user.displayName && <span className="user-email muted">{user.email}</span>}
            </span>
            <button className="small" onClick={() => actions.flush().finally(() => signOut(auth))}>Log out</button>
          </span>
        </nav>
        <div className="header-tools">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button
            className="menu-btn"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
          </button>
        </div>
      </header>
      <figure className="quote">
        <figcaption>The goal is simple</figcaption>
        <blockquote>Better than Yesterday.</blockquote>
      </figure>
      {syncError && (
        <div className="sync-error">
          ⚠ Couldn't sync with Firebase: {syncError}. Your changes are kept on this device and will retry.
        </div>
      )}

      <TabsBar tab={tab} onChange={goTab} />


      <main key={tab} className="tab-panel">
        {tab === 'dashboard' && (
          <>
            <div className="hstats">
              <StatPill icon="clock" color="#10b981" label="Today" value={fmt(stats.minutesOn(tk))} />
              <StatPill icon="calendar" color="#6366f1" label="This week" value={fmt(stats.minutesRange(mondayOf(d), addDays(sod(d), 1)))} />
              <StatPill icon="flame" color="#f97316" label="Streak" value={`${stats.streak()} ${stats.streak() === 1 ? 'day' : 'days'}`} />
              <StatPill icon="grid" color="#0ea5e9" label="Active days" value={activeDays} />
            </div>
            <div className="cards">
              {state.subjects.map((s) => (
                <SubjectCard key={s.id} s={s} {...common} onEditDay={setDayKey} />
              ))}
              <button className="card add-card" onClick={() => setSubjectDlg(null)}>
                <span className="plus">+</span>
                Add subject
              </button>
            </div>
            {state.subjects.length > 0 && (
              <div className="dash-bottom">
                <section>
                  <h2>Today <button className="small link" onClick={() => goTab('schedule')}>Edit schedule →</button></h2>
                  <TodayPlan {...common} />
                </section>
                <section>
                  <h2>Activity <button className="small link" onClick={() => goTab('progress')}>All progress →</button></h2>
                  <Heatmap sid={null} {...common} onDay={setDayKey} />
                </section>
              </div>
            )}
          </>
        )}

        {state.subjects.length === 0 && tab !== 'dashboard' && (
          <p className="muted empty-tab">Add a subject on the Dashboard to get started.</p>
        )}

        {tab === 'schedule' && state.subjects.length > 0 && <Schedule {...common} />}

        {tab === 'progress' && state.subjects.length > 0 && (
          <>
            <TimeChart {...common} />
            <Summary {...common} />
            <section>
              <h2>Activity <span className="muted hint">click any square to edit that day</span></h2>
              <Heatmap sid={null} {...common} onDay={setDayKey} />
              {state.subjects.map((s) => (
                <Heatmap key={s.id} sid={s.id} {...common} onDay={setDayKey} />
              ))}
            </section>
          </>
        )}

        {tab === 'topics' && state.subjects.length > 0 && <Topics {...common} />}
      </main>

      <ScheduleReminders state={state} stats={stats} />
      {dayKey && <DayDialog key={dayKey} initialKey={dayKey} state={state} actions={actions} onClose={() => setDayKey(null)} />}
      {settingsOpen && subjectDlg === undefined && (
        <SettingsDialog state={state} actions={actions} onClose={() => setSettingsOpen(false)} onEditSubject={setSubjectDlg} />
      )}
      {subjectDlg !== undefined && (
        <SubjectDialog subject={subjectDlg} state={state} actions={actions} onClose={() => setSubjectDlg(undefined)} />
      )}
      <FloatingTimer state={state} actions={actions} />
      <Tooltip />
    </div>
  );
}

function StatPill({ icon, color, label, value }) {
  return (
    <div className="pill">
      <div className="pill-icon" style={{ '--ic': color }}><Icon name={icon} size={22} /></div>
      <div className="pill-text"><span>{label}</span><b>{value}</b></div>
    </div>
  );
}

/** Loading screen that explains itself instead of spinning forever when Firestore can't be reached. */
function LoadingData({ user, error }) {
  const [shownAt] = useState(Date.now);
  const slow = useNow(2000) - shownAt >= 8000;
  if (!error && !slow) return <Splash text="Loading your data…" />;
  const denied = /permission|insufficient/i.test(error || '');
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>{error ? "Couldn't load your data" : 'Still loading…'}</h1>
        {error && <p className="error">{error}</p>}
        {denied ? (
          <p className="muted">
            Firestore is refusing access. In the Firebase Console open <b>Firestore Database → Rules</b>, replace them with the
            contents of <code>firestore.rules</code> from this project, click <b>Publish</b>, then reload this page.
          </p>
        ) : (
          <p className="muted">
            Can't reach Firestore. Check your internet connection, and that a Firestore database has been created in the
            Firebase Console (Firestore Database → Create database).
          </p>
        )}
        <div className="row">
          <button className="primary" onClick={() => location.reload()}>Reload</button>
          <button onClick={() => signOut(auth)}>Log out ({user.email})</button>
        </div>
      </div>
    </div>
  );
}

/** Show the running/paused timer in the browser tab title. */
function usePageTitle(state) {
  useEffect(() => {
    const t = state.timer;
    const name = state.subjects.find((s) => s.id === t?.sid)?.name;
    if (!t || !name) {
      document.title = 'LRNdaily';
      return;
    }
    const tick = () => { document.title = `${t.start ? '⏱' : '⏸'} ${fmtClock(timerElapsed(t))} · ${name} · LRNdaily`; };
    tick();
    if (!t.start) return;
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [state.timer, state.subjects]);
}
