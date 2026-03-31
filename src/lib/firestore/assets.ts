 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: assets
// Single source of truth: workspaces/main/assets
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



const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:assets]", ...args);
}

function logError(...args) {
  console.error("[OPENY:assets]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToAssets(
  callback,
  onError
) {
  log("subscribing to workspaces/main/assets");
  const q = query(wsCol("assets"), orderBy("createdAt", "desc"));
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

export async function createAsset(data) {
  const now = new Date().toISOString();
  const payload = {
    clientId: data.clientId,
    name: data.name,
    type: data.type,
    fileUrl: data.fileUrl,
    thumbnailUrl: _nullishCoalesce(data.thumbnailUrl, () => ( "")),
    fileSize: _nullishCoalesce(data.fileSize, () => ( 0)),
    format: _nullishCoalesce(data.format, () => ( "")),
    tags: _nullishCoalesce(data.tags, () => ( [])),
    folder: _nullishCoalesce(data.folder, () => ( "")),
    uploadedBy: _nullishCoalesce(data.uploadedBy, () => ( "")),
    createdAt: now,
    updatedAt: now,
  };
  log("createAsset", payload);
  const docRef = await addDoc(wsCol("assets"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateAsset(
  id,
  data
) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateAsset id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "assets", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteAsset(id) {
  log("deleteAsset id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "assets", id));
  log("deleted", id);
}
