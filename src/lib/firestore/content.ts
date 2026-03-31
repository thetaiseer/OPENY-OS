 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: content (contentItems)
// Single source of truth: workspaces/main/contentItems
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
  if (DEV) console.log("[OPENY:contentItems]", ...args);
}

function logError(...args) {
  console.error("[OPENY:contentItems]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToContentItems(
  callback,
  onError
) {
  log("subscribing to workspaces/main/contentItems");
  const q = query(wsCol("contentItems"), orderBy("createdAt", "desc"));
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

export async function createContentItem(data) {
  const now = new Date().toISOString();
  const payload = {
    clientId: data.clientId,
    title: data.title,
    description: _nullishCoalesce(data.description, () => ( "")),
    caption: _nullishCoalesce(data.caption, () => ( "")),
    hashtags: _nullishCoalesce(data.hashtags, () => ( [])),
    platform: data.platform,
    contentType: data.contentType,
    status: _nullishCoalesce(data.status, () => ( "idea")),
    priority: _nullishCoalesce(data.priority, () => ( "medium")),
    assignedTo: _nullishCoalesce(data.assignedTo, () => ( "")),
    scheduledDate: _nullishCoalesce(data.scheduledDate, () => ( "")),
    scheduledTime: _nullishCoalesce(data.scheduledTime, () => ( "")),
    publishedAt: null,
    approvalStatus: _nullishCoalesce(data.approvalStatus, () => ( "pending_internal")),
    attachments: _nullishCoalesce(data.attachments, () => ( [])),
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
  log("createContentItem", payload);
  const docRef = await addDoc(wsCol("contentItems"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateContentItem(
  id,
  data
) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateContentItem id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "contentItems", id),
    payload
  );
  log("updated", id);
}

// ── Add comment ──────────────────────────────────────────────

export async function addContentComment(
  id,
  comment
) {
  const newComment = { ...comment, id: crypto.randomUUID() };
  log("addContentComment id:", id, newComment);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "contentItems", id),
    {
      comments: arrayUnion(newComment),
      updatedAt: new Date().toISOString(),
    }
  );
  log("comment added to", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteContentItem(id) {
  log("deleteContentItem id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "contentItems", id));
  log("deleted", id);
}
