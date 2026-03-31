// ============================================================
// OPENY OS – Firebase Initialisation (single shared instance)
// ============================================================
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  collection,
  type CollectionReference,
  type DocumentData,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ── Workspace scope ──────────────────────────────────────────
// All business data is stored under workspaces/main/*
// using a single, fixed workspace ID so that every device and
// every browser sees exactly the same shared data.
export const DEFAULT_WORKSPACE_ID = "main";

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
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use an in-memory local cache so that Firestore write operations (addDoc,
// deleteDoc, updateDoc) apply to the local cache immediately and resolve the
// returned promise without waiting for server round-trip confirmation.  This
// eliminates the "hanging write → withTimeout fires → stuck button" problem.
// Unlike IndexedDB persistence, memoryLocalCache has no cross-tab lock
// coordination, so it never causes operations to hang in multi-tab sessions.
// Data is still synced to the Firestore server in the background; onSnapshot
// listeners receive updates from memory cache and from the server as they arrive.
function createFirestore() {
  try {
    return initializeFirestore(app, { localCache: memoryLocalCache() });
  } catch {
    // initializeFirestore throws when called a second time on the same app
    // (e.g. Next.js hot-module replacement).  Fall back to the existing instance.
    return getFirestore(app);
  }
}

export const db = createFirestore();
export const auth = getAuth(app);

// ── Workspace collection helper ──────────────────────────────
// Returns a typed Firestore CollectionReference scoped to the
// default workspace.  Use this everywhere instead of calling
// collection(db, "collectionName") directly so that all data
// lives under the same workspace path and is visible on every
// device.
//
// Usage:  wsCol("clients")
//      -> collection(db, "workspaces", "main", "clients")
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

// Web Push VAPID public key for Firebase Cloud Messaging.
// Generated in the Firebase console under Project Settings → Cloud Messaging → Web Push certificates.
export const FCM_VAPID_KEY =
  "BLo-zkIlw7g4UGy8qTgBfdCz12c4iMqRlwAn-S-hnjG_dAzjIL-ISFdjLLfuhxi_sU0wwveSmVmZ37x3YwqGwho";

// FCM – only initialised on the client to avoid SSR issues.
// Returns null when called server-side or when push is unsupported.
// Pass a custom vapidKey to override the project default (e.g. for multi-tenant setups).
export async function getFCMToken(vapidKey: string = FCM_VAPID_KEY): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const { getMessaging, getToken } = await import("firebase/messaging");
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey });
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
