"use client";

// ============================================================
// OPENY OS – Notification Context (Firestore-backed)
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "./firebase";
import type { AppNotification, NotificationType } from "./types";

// ── Context shape ─────────────────────────────────────────────

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  pushNotification: (
    type: NotificationType,
    title: string,
    message: string,
    entityId: string
  ) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const q = query(wsCol("notifications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
      },
      (err) => {
        console.error("[OPENY] Notifications listener error:", err);
      }
    );
    return unsub;
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const pushNotification = useCallback(
    async (type: NotificationType, title: string, message: string, entityId: string) => {
      await addDoc(wsCol("notifications"), {
        type,
        title,
        message,
        entityId,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    },
    []
  );

  const markAsRead = useCallback(async (id: string) => {
    await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", id), { isRead: true });
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => batch.update(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", n.id), { isRead: true }));
    await batch.commit();
  }, [notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "notifications", id));
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, pushNotification }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, pushNotification]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hooks ──────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}
