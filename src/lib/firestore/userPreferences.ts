 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
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








const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:userPreferences]", ...args);
}

function prefDoc(uid) {
  return doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "userPreferences", uid);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToUserPreferences(
  uid,
  callback,
  onError?
) {
  log("subscribing for uid:", uid);
  return onSnapshot(
    prefDoc(uid),
    (snap) => {
      if (snap.exists()) {
        log("snapshot received for uid:", uid);
        callback(snap.data() );
      } else {
        log("no prefs doc yet for uid:", uid);
        callback(null);
      }
    },
    (err) => {
      console.error("[OPENY:userPreferences] snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _ => _(err)]);
    }
  );
}

// ── Get (one-time) ───────────────────────────────────────────

export async function getUserPreferences(
  uid
) {
  const snap = await getDoc(prefDoc(uid));
  if (snap.exists()) return snap.data() ;
  return null;
}

// ── Upsert ───────────────────────────────────────────────────

export async function upsertUserPreferences(
  uid,
  prefs
) {
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
