// ============================================================
// OPENY OS – Firestore Service: activities
// Single source of truth: workspaces/main/activities
// ============================================================
import {
  addDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db, wsCol } from "@/lib/firebase";
import type { Activity, ActivityType } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:activities]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:activities]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToActivities(
  callback: (rows: Activity[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/activities");
  const q = query(wsCol("activities"), orderBy("timestamp", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Activity));
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      onError?.(err);
    }
  );
}

// ── Delete all ───────────────────────────────────────────────

export async function clearAllActivities(): Promise<void> {
  log("clearAllActivities start");
  const snap = await getDocs(wsCol("activities"));
  if (snap.empty) {
    log("clearAllActivities – nothing to delete");
    return;
  }
  // Firestore batch supports up to 500 ops; chunk if needed
  const BATCH_SIZE = 500;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  log("clearAllActivities done – deleted", docs.length, "docs");
}

// ── Create ───────────────────────────────────────────────────

export async function createActivity(
  type: ActivityType,
  message: string,
  detail: string,
  entityId: string
): Promise<string> {
  const payload = {
    type,
    message,
    detail,
    entityId,
    timestamp: new Date().toISOString(),
  };
  log("createActivity", payload);
  const docRef = await addDoc(wsCol("activities"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}
