import { initializeApp } from "firebase/app";
import { getAnalytics, type Analytics } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAhe1VPmT0hmLOAvinuCTkj3SqcldIKaJg",
  authDomain: "interval-timer-ddd55.firebaseapp.com",
  projectId: "interval-timer-ddd55",
  storageBucket: "interval-timer-ddd55.firebasestorage.app",
  messagingSenderId: "429463431971",
  appId: "1:429463431971:web:2550c28b33aa245504fa96",
  measurementId: "G-DK2JKG8Q2X",
};

const app = initializeApp(firebaseConfig);
let analytics: Analytics | null = null;

export function initAnalytics(): Analytics | null {
  if (typeof window === "undefined") return null;
  if (!analytics) {
    analytics = getAnalytics(app);
  }
  return analytics;
}

export const auth = getAuth(app);

// Set auth persistence to local (survives browser restarts)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Auth persistence failed:", err);
});

export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);

export { app, onAuthStateChanged };
