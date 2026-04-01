// ============================================================
// OPENY OS – Firebase Client Initialisation
// This is the ONLY Firebase entry point for frontend/client usage.
// DO NOT import firebase-admin or any server-only SDK from here.
// ============================================================
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  collection,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ── Workspace scope ──────────────────────────────────────────
// All business data lives under workspaces/main/* so that every
// device and browser sees exactly the same shared data.
export const DEFAULT_WORKSPACE_ID = "main";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Prevent duplicate app initialisation in Next.js hot-reload / SSR.
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use in-memory local cache so Firestore writes resolve immediately without
// waiting for a server round-trip confirmation.  This eliminates the
// "hanging write → withTimeout fires → stuck button" problem.
// Unlike IndexedDB persistence, memoryLocalCache has no cross-tab lock
// coordination so it never causes operations to hang in multi-tab sessions.
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
// Only initialise Auth on the client side. During SSR / static prerender the
// NEXT_PUBLIC_FIREBASE_* env vars may be absent, which causes getAuth() to
// throw auth/invalid-api-key and fail the build.
// The try/catch also guards against an invalid/missing API key at runtime —
// without it the thrown FirebaseError propagates at module-evaluation time and
// crashes the entire client bundle, causing every page that transitively imports
// this module (e.g. /clients) to show "This page couldn't load".
function createAuth(): ReturnType<typeof getAuth> {
  if (typeof window === "undefined") return null as unknown as ReturnType<typeof getAuth>;
  try {
    return getAuth(app);
  } catch (err) {
    console.error("[OPENY:firebase] Auth initialisation failed – check NEXT_PUBLIC_FIREBASE_* env vars:", err);
    return null as unknown as ReturnType<typeof getAuth>;
  }
}
export const auth = createAuth();

// ── Workspace collection helper ──────────────────────────────
// Returns a CollectionReference scoped to the default workspace.
// Use this everywhere instead of calling collection(db, "name") directly
// so that all data lives under the same workspace path and is visible
// on every device.
//
// Usage:  wsCol("clients")
//      -> collection(db, "workspaces", "main", "clients")
export function wsCol(collectionName: string) {
  return collection(db, "workspaces", DEFAULT_WORKSPACE_ID, collectionName);
}

// Analytics – only initialised on the client to avoid SSR issues.
export async function getAnalyticsInstance() {
  if (typeof window === "undefined") return null;
  const { getAnalytics } = await import("firebase/analytics");
  return getAnalytics(app);
}

// Web Push VAPID public key for Firebase Cloud Messaging.
export const FCM_VAPID_KEY =
  "BLo-zkIlw7g4UGy8qTgBfdCz12c4iMqRlwAn-S-hnjG_dAzjIL-ISFdjLLfuhxi_sU0wwveSmVmZ37x3YwqGwho";

// FCM – only initialised on the client to avoid SSR issues.
// Returns null when called server-side or when push is unsupported.
export async function getFCMToken(vapidKey = FCM_VAPID_KEY) {
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

// Request browser push permission and persist the FCM token in Firestore.
export async function requestPushPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { granted: false, token: null };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { granted: false, token: null };
  const token = await getFCMToken();
  if (token) {
    try {
      const { addDoc, collection: col } = await import("firebase/firestore");
      await addDoc(col(db, "fcmTokens"), {
        token,
        createdAt: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
    } catch {
      // Non-critical – log silently
    }
  }
  return { granted: true, token };
}

export default app;
