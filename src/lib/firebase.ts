// ============================================================
// OPENY OS – Firebase Initialisation (single shared instance)
// ============================================================
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAhXa5gLCMIIxuFIAj0RFeFEvAcE5TiilY",
  authDomain: "openy-suite.firebaseapp.com",
  projectId: "openy-suite",
  storageBucket: "openy-suite.firebasestorage.app",
  messagingSenderId: "735713304757",
  appId: "1:735713304757:web:62a46c1670e281efa2defc",
  measurementId: "G-6VJ1ZZPD5E",
};

// Prevent duplicate initialisation in Next.js hot-reload and SSR environments.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

// Analytics – only initialised on the client to avoid SSR issues.
export async function getAnalyticsInstance() {
  if (typeof window === "undefined") return null;
  const { getAnalytics } = await import("firebase/analytics");
  return getAnalytics(app);
}

export default app;
