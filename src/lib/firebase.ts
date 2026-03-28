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

// FCM – only initialised on the client to avoid SSR issues.
// Returns null when called server-side or when push is unsupported.
export async function getFCMToken(vapidKey?: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, vapidKey ? { vapidKey } : undefined);
    return token || null;
  } catch {
    return null;
  }
}

// Request browser push permission and get FCM token.
// Stores the token in Firestore under fcmTokens/{token}.
export async function requestPushPermission(): Promise<{ granted: boolean; token: string | null }> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { granted: false, token: null };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { granted: false, token: null };
  const token = await getFCMToken();
  if (token) {
    try {
      const { addDoc, collection } = await import("firebase/firestore");
      await addDoc(collection(db, "fcmTokens"), {
        token,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } catch {
      // Non-critical — log silently
    }
  }
  return { granted: true, token };
}

export default app;
