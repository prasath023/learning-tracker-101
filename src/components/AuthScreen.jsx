import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { applyTheme, currentTheme } from '../lib/theme';
import { Brand, ThemeToggle } from './ui';

const MESSAGES = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-not-found': 'No account with that email.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/email-already-in-use': 'An account with this email already exists — log in instead.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Network error — check your internet connection.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled in the Firebase console.',
};
const friendly = (e) => MESSAGES[e.code] || e.message;

export default function AuthScreen() {
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState(currentTheme);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setTheme(next);
  };

  const run = async (fn) => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'login') run(() => signInWithEmailAndPassword(auth, email.trim(), password));
    else if (mode === 'signup') {
      run(async () => {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      });
    } else {
      run(async () => {
        await sendPasswordResetEmail(auth, email.trim());
        setInfo('Password reset email sent — check your inbox (and spam).');
      });
    }
  };

  const switchTo = (m) => {
    setMode(m);
    setError('');
    setInfo('');
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <div className="auth-logo" aria-hidden>
          <i className="cell l4" /><i className="cell l3" /><i className="cell l2" /><i className="cell l4" />
        </div>
        <h1><Brand /></h1>
        <p className="muted auth-sub">
          {mode === 'login' ? 'Log in to continue your streak.' : mode === 'signup' ? 'Create an account to track your learning.' : 'Reset your password.'}
        </p>

        <form className="form" onSubmit={submit}>
          {mode === 'signup' && (
            <label>Name
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
          )}
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus />
          </label>
          {mode !== 'reset' && (
            <label>Password
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </label>
          )}
          {error && <p className="error">{error}</p>}
          {info && <p className="ok">{info}</p>}
          <button className="primary" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Sign up' : 'Send reset email'}
          </button>
        </form>

        {mode !== 'reset' && (
          <>
            <div className="divider"><span>or</span></div>
            <button className="google" disabled={busy} onClick={() => run(() => signInWithPopup(auth, new GoogleAuthProvider()))}>
              Continue with Google
            </button>
          </>
        )}

        <div className="auth-links">
          {mode === 'login' && (
            <>
              <span>No account? <button className="link" onClick={() => switchTo('signup')}>Sign up</button></span>
              <button className="link" onClick={() => switchTo('reset')}>Forgot password?</button>
            </>
          )}
          {mode === 'signup' && <span>Already have an account? <button className="link" onClick={() => switchTo('login')}>Log in</button></span>}
          {mode === 'reset' && <button className="link" onClick={() => switchTo('login')}>← Back to log in</button>}
        </div>
      </div>
    </div>
  );
}
