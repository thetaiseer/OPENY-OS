"use client";

// ============================================================
// OPENY OS – Notification Preferences Hook (in-memory)
// Auth has been removed. Preferences are stored in React state
// and reset on page reload. No Supabase calls are made.
// ============================================================
import { useCallback, useMemo, useState } from "react";

const DEFAULT_PREFS = {
  approvals: { inApp: true, push: true, email: true },
  publishingReminders: { inApp: true, push: true, email: false },
  taskAlerts: { inApp: true, push: false, email: false },
  invitationEmails: { inApp: true, push: false, email: true },
  systemAlerts: { inApp: true, push: false, email: false },
  clientActions: { inApp: true, push: true, email: true },
};

export function useNotificationPreferences() {
  const [prefs, setPrefs] = useState<Record<string, Record<string, boolean>>>(DEFAULT_PREFS);

  const updateCategory = useCallback(
    (category: string, channel: string, value: boolean) => {
      setPrefs((prev) => ({
        ...prev,
        [category]: { ...(prev[category] ?? {}), [channel]: value },
      }));
    },
    []
  );

  const effectivePrefs = useMemo(
    () => ({ id: "", userId: "", ...prefs }),
    [prefs]
  );

  return { prefs: effectivePrefs, loading: false, updateCategory };
}
