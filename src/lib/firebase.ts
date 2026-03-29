// ============================================================
// OPENY OS – Firebase Initialisation (single shared instance)
// ============================================================
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ── Workspace scope ──────────────────────────────────────────
// All business data is stored under workspaces/{workspaceId}/*
// so that it is scoped, persists across devices, and never
// conflicts with root-level system collections.
export const DEFAULT_WORKSPACE_ID = "default";

const firebaseConfig = {
  apiKey: "AIzaSyAhXa5gLCMIIxuFIAj0RFeFEvAcE5TiilY",
  authDomain: "openy-suite.firebaseapp.com",
  projectId: "openy-suite",
  storageBucket: "openy-suite.firebasestorage.app",
  messagingSenderId: "735713304757",
  appId: "1:735713304757:web:62a46c1670e281efa2defc",
  measurementId: "G-6VJ1ZZPD5E",
};

// Prevent duplicate app initialisation in Next.js hot-reload and SSR environments.
const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();

// Enable persistent multi-tab local cache on the browser so data survives page
// refreshes and hot-reloads. On the server (SSR) or when the app was already
// initialised we fall back to the default in-memory Firestore instance.
function createDb() {
  if (typeof window !== "undefined" && isNewApp) {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (err) {
      // Already initialised with different settings (e.g. after hot-reload).
      // Log for debugging but continue — getFirestore() returns the existing instance.
      console.warn("[OPENY] initializeFirestore skipped (already initialised):", err);
    }
  }
  return getFirestore(app);
}

export const db = createDb();
export const auth = getAuth(app);

// ── Workspace collection helper ──────────────────────────────
// Returns a typed Firestore CollectionReference scoped to the
// default workspace.  Use this everywhere instead of calling
// collection(db, "collectionName") directly so that all data
// lives under the same workspace path and is visible on every
// device.
//
// Usage:  wsCol("clients")
//      -> collection(db, "workspaces", DEFAULT_WORKSPACE_ID, "clients")
export function wsCol(
  collectionName: string
): CollectionReference<DocumentData> {
  return collection(db, "workspaces", DEFAULT_WORKSPACE_ID, collectionName);
}

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
