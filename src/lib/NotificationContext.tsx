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
import type { AppNotification, NotificationType } from "./types";
import {
  subscribeToNotifications,
  pushNotification as fsPushNotification,
  markNotificationRead,
  markAllNotificationsRead as fsMarkAllRead,
  deleteNotification as fsDeleteNotification,
} from "./firestore/notifications";

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
    const unsub = subscribeToNotifications(
      (rows) => setNotifications(rows),
    );
    return unsub;
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const pushNotification = useCallback(
    async (type: NotificationType, title: string, message: string, entityId: string) => {
      await fsPushNotification(type, title, message, entityId);
    },
    []
  );

  const markAsRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    await fsMarkAllRead(notifications);
  }, [notifications]);

  const deleteNotification = useCallback(async (id: string) => {
    await fsDeleteNotification(id);
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
