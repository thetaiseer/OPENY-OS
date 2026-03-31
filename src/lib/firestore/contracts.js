 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: contracts
// Subcollection path: workspaces/main/clients/{clientId}/contracts
// ============================================================
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:contracts]", ...args);
}

function logError(...args) {
  console.error("[OPENY:contracts]", ...args);
}

function contractsCol(clientId) {
  return collection(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "clients",
    clientId,
    "contracts"
  );
}

function contractDoc(clientId, contractId) {
  return doc(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "clients",
    clientId,
    "contracts",
    contractId
  );
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToContracts(
  clientId,
  callback,
  onError
) {
  log("subscribing to contracts for client:", clientId);
  const q = query(contractsCol(clientId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        clientId,
        ...d.data(),
      } ));
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












export async function createContract(data) {
  const now = new Date().toISOString();
  const payload = {
    title: data.title,
    fileUrl: data.fileUrl,
    storagePath: data.storagePath,
    startDate: _nullishCoalesce(data.startDate, () => ( null)),
    endDate: _nullishCoalesce(data.endDate, () => ( null)),
    status: _nullishCoalesce(data.status, () => ( "draft")),
    uploadedBy: _nullishCoalesce(data.uploadedBy, () => ( "")),
    createdAt: now,
  };
  log("createContract for client:", data.clientId, payload);
  const docRef = await addDoc(contractsCol(data.clientId), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateContract(
  clientId,
  contractId,
  data
) {
  log("updateContract clientId:", clientId, "id:", contractId, data);
  await updateDoc(contractDoc(clientId, contractId), data);
  log("updated", contractId);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteContract(
  clientId,
  contractId
) {
  log("deleteContract clientId:", clientId, "id:", contractId);
  await deleteDoc(contractDoc(clientId, contractId));
  log("deleted", contractId);
}
