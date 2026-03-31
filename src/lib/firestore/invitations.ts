 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
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


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:invitations]", ...args);
}

function logError(...args) {
  console.error("[OPENY:invitations]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToInvitations(
  callback,
  onError?
) {
  log("subscribing to workspaces/main/invitations");
  const q = query(wsCol("invitations"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, any> & { id: string }));
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

export async function createInvitation(
  payload
) {
  log("createInvitation", payload);
  const docRef = await addDoc(wsCol("invitations"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Read by token ─────────────────────────────────────────────

export async function getInvitationByToken(
  token
) {
  log("getInvitationByToken token:", token);
  const q = query(wsCol("invitations"), where("token", "==", token));
  const snap = await getDocs(q);
  if (snap.empty) {
    log("not found");
    return null;
  }
  const d = snap.docs[0];
  const result = { id: d.id, ...d.data() } as Record<string, any> & { id: string };
  log("found", result.id);
  return result;
}

// ── Update ───────────────────────────────────────────────────

export async function updateInvitation(
  id,
  payload
) {
  log("updateInvitation id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteInvitation(id) {
  log("deleteInvitation id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "invitations", id));
  log("deleted", id);
}
