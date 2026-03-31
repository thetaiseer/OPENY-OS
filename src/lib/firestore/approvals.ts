 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: approvals
// Single source of truth: workspaces/main/approvals
// ============================================================
import {
  addDoc,
  arrayUnion,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";



const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:approvals]", ...args);
}

function logError(...args) {
  console.error("[OPENY:approvals]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToApprovals(
  callback,
  onError
) {
  log("subscribing to workspaces/main/approvals");
  const q = query(wsCol("approvals"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } ));
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _ => _(err)]);
    }
  );
}

// ── Create ───────────────────────────────────────────────────

export async function createApproval(data) {
  const now = new Date().toISOString();
  const payload = {
    contentItemId: data.contentItemId,
    clientId: data.clientId,
    status: _nullishCoalesce(data.status, () => ( "pending_internal")),
    assignedTo: _nullishCoalesce(data.assignedTo, () => ( "")),
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
  id,
  data
) {
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
  id,
  status
) {
  log("updateApprovalStatus id:", id, "status:", status);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    { status, updatedAt: new Date().toISOString() }
  );
  log("status updated", id);
}

// ── Add comment ──────────────────────────────────────────────

export async function addApprovalInternalComment(
  id,
  comment
) {
  const newComment = { ...comment, id: crypto.randomUUID() };
  log("addApprovalInternalComment id:", id, newComment);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    {
      internalComments: arrayUnion(newComment),
      updatedAt: new Date().toISOString(),
    }
  );
  log("internal comment added to", id);
}

export async function addApprovalClientComment(
  id,
  comment
) {
  const newComment = { ...comment, id: crypto.randomUUID() };
  log("addApprovalClientComment id:", id, newComment);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id),
    {
      clientComments: arrayUnion(newComment),
      updatedAt: new Date().toISOString(),
    }
  );
  log("client comment added to", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteApproval(id) {
  log("deleteApproval id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", id));
  log("deleted", id);
}
