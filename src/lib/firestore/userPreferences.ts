// ============================================================
// OPENY OS – Firestore Service: userPreferences
// Stores per-user UI preferences (theme, language) so they
// sync across devices automatically.
//
// Document path: workspaces/main/userPreferences/{uid}
// ============================================================
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";

export interface UserPreferences {
  uid: string;
  theme: "dark" | "light";
  language: "en" | "ar";
  updatedAt: string;
}

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:userPreferences]", ...args);
}

function prefDoc(uid: string) {
  return doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "userPreferences", uid);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToUserPreferences(
  uid: string,
  callback: (prefs: UserPreferences | null) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing for uid:", uid);
  return onSnapshot(
    prefDoc(uid),
    (snap) => {
      if (snap.exists()) {
        log("snapshot received for uid:", uid);
        callback(snap.data() as UserPreferences);
      } else {
        log("no prefs doc yet for uid:", uid);
        callback(null);
      }
    },
    (err) => {
      console.error("[OPENY:userPreferences] snapshot error:", err);
      onError?.(err);
    }
  );
}

// ── Get (one-time) ───────────────────────────────────────────

export async function getUserPreferences(
  uid: string
): Promise<UserPreferences | null> {
  const snap = await getDoc(prefDoc(uid));
  if (snap.exists()) return snap.data() as UserPreferences;
  return null;
}

// ── Upsert ───────────────────────────────────────────────────

export async function upsertUserPreferences(
  uid: string,
  prefs: Pick<UserPreferences, "theme" | "language">
): Promise<void> {
  log("upsertUserPreferences uid:", uid, prefs);
  await setDoc(
    prefDoc(uid),
    {
      uid,
      ...prefs,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
