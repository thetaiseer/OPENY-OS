// ============================================================
// OPENY OS – Firestore Service: clientNotes
// Single source of truth: workspaces/main/clientNotes
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
import type { ClientNote } from "@/lib/types";
import type { CreateNoteData } from "@/lib/ClientNotesContext";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:clientNotes]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:clientNotes]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToClientNotes(
  callback: (rows: ClientNote[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/clientNotes");
  const q = query(wsCol("clientNotes"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientNote));
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

export async function createClientNote(data: CreateNoteData): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    clientId: data.clientId,
    type: data.type,
    content: data.content,
    author: data.author,
    tag: data.tag ?? "",
    createdAt: now,
    updatedAt: now,
  };
  log("createClientNote", payload);
  const docRef = await addDoc(wsCol("clientNotes"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateClientNote(
  id: string,
  data: Partial<Omit<ClientNote, "id" | "createdAt">>
): Promise<void> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateClientNote id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "clientNotes", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteClientNote(id: string): Promise<void> {
  log("deleteClientNote id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "clientNotes", id));
  log("deleted", id);
}
