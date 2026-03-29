// ============================================================
// OPENY OS – Firestore Service: tasks
// Single source of truth: workspaces/main/tasks
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
import type { Task } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:tasks]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:tasks]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToTasks(
  callback: (rows: Task[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/tasks");
  const q = query(wsCol("tasks"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
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

export async function createTask(
  payload: Omit<Task, "id">
): Promise<string> {
  log("createTask", payload);
  const docRef = await addDoc(wsCol("tasks"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateTask(
  id: string,
  payload: Partial<Omit<Task, "id">>
): Promise<void> {
  log("updateTask id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "tasks", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteTask(id: string): Promise<void> {
  log("deleteTask id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "tasks", id));
  log("deleted", id);
}
