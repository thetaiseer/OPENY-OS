 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: notifications
// Single source of truth: workspaces/main/notifications
// ============================================================
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:notifications]", ...args);
}

function logError(...args) {
  console.error("[OPENY:notifications]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToNotifications(
  callback,
  onError?
) {
  log("subscribing to workspaces/main/notifications");
  const q = query(wsCol("notifications"), orderBy("createdAt", "desc"));
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

export async function pushNotification(
  type,
  title,
  message,
  entityId
) {
  const payload = {
    type,
    title,
    message,
    entityId,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  log("pushNotification", payload);
  const docRef = await addDoc(wsCol("notifications"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function markNotificationRead(id) {
  log("markNotificationRead id:", id);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", id),
    { isRead: true }
  );
}

export async function markAllNotificationsRead(
  notifications
) {
  const unread = notifications.filter((n) => !n.isRead);
  if (unread.length === 0) return;
  log("markAllNotificationsRead count:", unread.length);
  const batch = writeBatch(db);
  unread.forEach((n) =>
    batch.update(
      doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", n.id),
      { isRead: true }
    )
  );
  await batch.commit();
  log("batch committed");
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteNotification(id) {
  log("deleteNotification id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", id));
  log("deleted", id);
}
