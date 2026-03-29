// ============================================================
// OPENY OS – Firestore Service: invitations
// Single source of truth: workspaces/main/invitations
// ============================================================
import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { Invitation, InvitationStatus } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:invitations]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:invitations]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToInvitations(
  callback: (rows: Invitation[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/invitations");
  const q = query(wsCol("invitations"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invitation));
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

export async function createInvitation(
  payload: Omit<Invitation, "id">
): Promise<string> {
  log("createInvitation", payload);
  const docRef = await addDoc(wsCol("invitations"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Read by token ─────────────────────────────────────────────

export async function getInvitationByToken(
  token: string
): Promise<Invitation | null> {
  log("getInvitationByToken token:", token);
  const q = query(wsCol("invitations"), where("token", "==", token));
  const snap = await getDocs(q);
  if (snap.empty) {
    log("not found");
    return null;
  }
  const d = snap.docs[0];
  const result = { id: d.id, ...d.data() } as Invitation;
  log("found", result.id);
  return result;
}

// ── Update ───────────────────────────────────────────────────

export async function updateInvitation(
  id: string,
  payload: Partial<Omit<Invitation, "id">>
): Promise<void> {
  log("updateInvitation id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteInvitation(id: string): Promise<void> {
  log("deleteInvitation id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", id));
  log("deleted", id);
}
