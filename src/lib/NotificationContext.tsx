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
  useState } from

"react";

import {
  subscribeToNotifications,
  pushNotification as fsPushNotification,
  markNotificationRead,
  markAllNotificationsRead as fsMarkAllRead,
  deleteNotification as fsDeleteNotification } from
"./supabase/notifications";

// ── Context shape ─────────────────────────────────────────────















const NotificationContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsub = subscribeToNotifications(
      (rows) => setNotifications(rows)
    );
    return unsub;
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const pushNotification = useCallback(
    async (type, title, message, entityId) => {
      await fsPushNotification(type, title, message, entityId);
    },
    []
  );

  const markAsRead = useCallback(async (id) => {
    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    await fsMarkAllRead(notifications);
  }, [notifications]);

  const deleteNotification = useCallback(async (id) => {
    await fsDeleteNotification(id);
  }, []);

  const value = useMemo(
    () => ({ notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, pushNotification }),
    [notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, pushNotification]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>);

}

// ── Hooks ──────────────────────────────────────────────────────

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationProvider>");
  return ctx;
}