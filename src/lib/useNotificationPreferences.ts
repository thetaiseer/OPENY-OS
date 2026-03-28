"use client";

// ============================================================
// OPENY OS – Notification Preferences Hook (Firestore-backed)
// Phase 4: Advanced Notifications
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  UserNotificationPreferences,
  NotificationChannelPrefs,
} from "./types";

const DEFAULT_CHANNEL: NotificationChannelPrefs = {
  inApp: true,
  push: false,
  email: false,
};

const DEFAULT_PREFS: Omit<UserNotificationPreferences, "id" | "userId" | "updatedAt"> = {
  approvals: { inApp: true, push: true, email: true },
  publishingReminders: { inApp: true, push: true, email: false },
  taskAlerts: { inApp: true, push: false, email: false },
  campaignAlerts: { inApp: true, push: false, email: false },
  invitationEmails: { inApp: true, push: false, email: true },
  systemAlerts: { inApp: true, push: false, email: false },
  clientActions: { inApp: true, push: true, email: true },
};

// The current user id – in a real app this comes from Auth.
// We use a fixed sentinel for now so preferences are shared.
const CURRENT_USER_ID = "default_user";

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<UserNotificationPreferences | null>(null);
  const [docId, setDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "userNotificationPreferences"),
      where("userId", "==", CURRENT_USER_ID)
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          // Create default preferences for this user
          const now = new Date().toISOString();
          const ref = await addDoc(
            collection(db, "userNotificationPreferences"),
            {
              userId: CURRENT_USER_ID,
              ...DEFAULT_PREFS,
              updatedAt: now,
            }
          );
          setDocId(ref.id);
        } else {
          const d = snap.docs[0];
          setDocId(d.id);
          setPrefs({ id: d.id, ...d.data() } as UserNotificationPreferences);
        }
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] NotificationPreferences listener error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  const updateCategory = useCallback(
    async (
      category: keyof Omit<
        UserNotificationPreferences,
        "id" | "userId" | "updatedAt"
      >,
      channel: keyof NotificationChannelPrefs,
      value: boolean
    ) => {
      if (!docId) return;
      const currentCategoryPrefs =
        prefs?.[category] ?? DEFAULT_CHANNEL;
      await updateDoc(doc(db, "userNotificationPreferences", docId), {
        [category]: {
          ...currentCategoryPrefs,
          [channel]: value,
        },
        updatedAt: new Date().toISOString(),
      });
    },
    [docId, prefs]
  );

  const effectivePrefs = useMemo(
    () =>
      prefs ?? {
        id: "",
        userId: CURRENT_USER_ID,
        ...DEFAULT_PREFS,
        updatedAt: "",
      },
    [prefs]
  );

  return { prefs: effectivePrefs, loading, updateCategory };
}
