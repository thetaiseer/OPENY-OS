// ============================================================
// OPENY OS – Firestore Service: approvals
// Single source of truth: workspaces/main/approvals
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
import type { Approval, ApprovalComment, ApprovalWorkflowStatus } from "@/lib/types";
import type { CreateApprovalData } from "@/lib/ApprovalContext";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:approvals]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:approvals]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToApprovals(
  callback: (rows: Approval[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/approvals");
  const q = query(wsCol("approvals"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Approval));
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

export async function createApproval(data: CreateApprovalData): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    contentItemId: data.contentItemId,
    clientId: data.clientId,
    status: data.status ?? "pending_internal",
    assignedTo: data.assignedTo ?? "",
    internalComments: [],
    clientComments: [],
    createdAt: now,
    updatedAt: now,
  };
  log("createApproval", payload);
  const docRef = await addDoc(wsCol("approvals"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateApproval(
  id: string,
  data: Partial<Omit<Approval, "id" | "createdAt">>
): Promise<void> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateApproval id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    payload
  );
  log("updated", id);
}

// ── Update status ─────────────────────────────────────────────

export async function updateApprovalStatus(
  id: string,
  status: ApprovalWorkflowStatus
): Promise<void> {
  log("updateApprovalStatus id:", id, "status:", status);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    { status, updatedAt: new Date().toISOString() }
  );
  log("status updated", id);
}

// ── Add comment ──────────────────────────────────────────────

export async function addApprovalInternalComment(
  id: string,
  existingComments: ApprovalComment[],
  comment: Omit<ApprovalComment, "id">
): Promise<void> {
  const newComment: ApprovalComment = { ...comment, id: crypto.randomUUID() };
  log("addApprovalInternalComment id:", id, newComment);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    {
      internalComments: [...existingComments, newComment],
      updatedAt: new Date().toISOString(),
    }
  );
  log("internal comment added to", id);
}

export async function addApprovalClientComment(
  id: string,
  existingComments: ApprovalComment[],
  comment: Omit<ApprovalComment, "id">
): Promise<void> {
  const newComment: ApprovalComment = { ...comment, id: crypto.randomUUID() };
  log("addApprovalClientComment id:", id, newComment);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    {
      clientComments: [...existingComments, newComment],
      updatedAt: new Date().toISOString(),
    }
  );
  log("client comment added to", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteApproval(id: string): Promise<void> {
  log("deleteApproval id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id));
  log("deleted", id);
}
