// ============================================================
// OPENY OS – Firestore Service: recurringTaskTemplates
// Single source of truth: workspaces/main/recurringTaskTemplates
// ============================================================
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { RecurringTaskTemplate } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:recurringTasks]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:recurringTasks]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToRecurringTaskTemplates(
  callback: (rows: RecurringTaskTemplate[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/recurringTaskTemplates");
  const q = query(wsCol("recurringTaskTemplates"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecurringTaskTemplate));
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      onError?.(err);
    }
  );
}

// ── Create ───────────────────────────────────────────────────

export async function createRecurringTaskTemplate(
  payload: Omit<RecurringTaskTemplate, "id">
): Promise<string> {
  log("createRecurringTaskTemplate", payload);
  const docRef = await addDoc(wsCol("recurringTaskTemplates"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateRecurringTaskTemplate(
  id: string,
  payload: Partial<Omit<RecurringTaskTemplate, "id">>
): Promise<void> {
  log("updateRecurringTaskTemplate id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "recurringTaskTemplates", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteRecurringTaskTemplate(id: string): Promise<void> {
  log("deleteRecurringTaskTemplate id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "recurringTaskTemplates", id));
  log("deleted", id);
}
