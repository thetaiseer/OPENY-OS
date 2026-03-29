// ============================================================
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
import type { AppNotification, NotificationType } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:notifications]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:notifications]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToNotifications(
  callback: (rows: AppNotification[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/notifications");
  const q = query(wsCol("notifications"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification));
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

export async function pushNotification(
  type: NotificationType,
  title: string,
  message: string,
  entityId: string
): Promise<string> {
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

export async function markNotificationRead(id: string): Promise<void> {
  log("markNotificationRead id:", id);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", id),
    { isRead: true }
  );
}

export async function markAllNotificationsRead(
  notifications: AppNotification[]
): Promise<void> {
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

export async function deleteNotification(id: string): Promise<void> {
  log("deleteNotification id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", id));
  log("deleted", id);
}
