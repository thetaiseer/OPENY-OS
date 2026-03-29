// ============================================================
// OPENY OS – Firestore Service: clients
// Single source of truth: workspaces/main/clients
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
import type { Client } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:clients]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:clients]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

/** Real-time subscription. Returns an unsubscribe function. */
export function subscribeToClients(
  callback: (rows: Client[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/clients");
  const q = query(wsCol("clients"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client));
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

export async function createClient(
  payload: Omit<Client, "id">
): Promise<string> {
  log("createClient", payload);
  const docRef = await addDoc(wsCol("clients"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateClient(
  id: string,
  payload: Partial<Omit<Client, "id">>
): Promise<void> {
  log("updateClient id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "clients", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteClient(id: string): Promise<void> {
  log("deleteClient id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "clients", id));
  log("deleted", id);
}
