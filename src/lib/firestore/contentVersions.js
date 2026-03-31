 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: contentVersions
// Subcollection path: workspaces/main/contentItems/{contentId}/versions
// ============================================================
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:contentVersions]", ...args);
}

function logError(...args) {
  console.error("[OPENY:contentVersions]", ...args);
}

function versionsCol(contentItemId) {
  return collection(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "contentItems",
    contentItemId,
    "versions"
  );
}

function versionDoc(contentItemId, versionId) {
  return doc(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "contentItems",
    contentItemId,
    "versions",
    versionId
  );
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToContentVersions(
  contentItemId,
  callback,
  onError
) {
  log("subscribing to versions for content:", contentItemId);
  const q = query(versionsCol(contentItemId), orderBy("versionNumber", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        contentItemId,
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










export async function createContentVersion(
  data
) {
  const now = new Date().toISOString();
  const payload = {
    versionNumber: data.versionNumber,
    previewUrl: data.previewUrl,
    storagePath: data.storagePath,
    uploadedBy: data.uploadedBy,
    note: _nullishCoalesce(data.note, () => ( "")),
    createdAt: now,
  };
  log("createContentVersion for content:", data.contentItemId, payload);
  const docRef = await addDoc(versionsCol(data.contentItemId), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteContentVersion(
  contentItemId,
  versionId
) {
  log("deleteContentVersion contentItemId:", contentItemId, "id:", versionId);
  await deleteDoc(versionDoc(contentItemId, versionId));
  log("deleted", versionId);
}
