import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';

// Values come from .env.local (see .env.example). Firebase web config is public by design;
// access to data is protected by Firestore security rules (firestore.rules).
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!config.apiKey || !config.projectId) {
  throw new Error('Firebase config missing — copy .env.example to .env.local and fill it in.');
}

export const app = initializeApp(config);
export const auth = getAuth(app);
// Data lives only in Firestore: an in-memory cache, nothing persisted in the browser.
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });

// One-time tidy-up of what earlier versions left in the browser: localStorage keys and
// the old Firestore offline cache (IndexedDB). Nothing is written there any more.
try {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('learning-tracker-') || k.startsWith('lrndaily:')) localStorage.removeItem(k);
  }
} catch {
  /* storage unavailable */
}
indexedDB?.databases?.()
  .then((dbs) => dbs.forEach(({ name }) => name?.startsWith('firestore/') && indexedDB.deleteDatabase(name)))
  .catch(() => {});
