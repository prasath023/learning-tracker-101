import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import App from './App';
import AuthScreen from './components/AuthScreen';
import { Splash } from './components/ui';

export default function Root() {
  const [user, setUser] = useState(undefined); // undefined = still checking
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <Splash />;
  if (!user) return <AuthScreen />;
  // key: remount everything (fresh state) when a different user logs in
  return <App key={user.uid} user={user} />;
}
