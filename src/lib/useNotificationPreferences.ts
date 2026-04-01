"use client";

// ============================================================
// OPENY OS – Notification Preferences Hook (Supabase-backed)
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "./supabase/client";
import { useAuth } from "./AuthContext";

const TABLE = "user_notification_preferences";

const DEFAULT_PREFS = {
  approvals: { inApp: true, push: true, email: true },
  publishingReminders: { inApp: true, push: true, email: false },
  taskAlerts: { inApp: true, push: false, email: false },
  invitationEmails: { inApp: true, push: false, email: true },
  systemAlerts: { inApp: true, push: false, email: false },
  clientActions: { inApp: true, push: true, email: true },
};

export function useNotificationPreferences() {
  const { user } = useAuth();
  const userId = (user as any)?.email ?? "";
  const [prefs, setPrefs] = useState<Record<string, unknown> | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [_loading, setLoading] = useState(true);
  const loading = userId ? _loading : false;

  useEffect(() => {
    if (!userId) return;
    const sb = getSupabaseClient();
    let cancelled = false;

    const fetchOrCreate = async () => {
      const { data } = await sb.from(TABLE).select("*").eq("user_id", userId).limit(1);
      if (cancelled) return;
      if (data && data.length > 0) {
        const row = data[0];
        setRowId(row.id as string);
        setPrefs({ id: row.id as string, userId: row.user_id as string, ...((row.preferences as Record<string, unknown>) ?? DEFAULT_PREFS) });
        setLoading(false);
      } else {
        // Create default prefs row
        const { data: created } = await sb
          .from(TABLE)
          .insert({
            user_id: userId,
            preferences: DEFAULT_PREFS,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (cancelled) return;
        if (created) {
          setRowId(created.id as string);
          setPrefs({ id: created.id as string, userId, ...DEFAULT_PREFS });
        }
        setLoading(false);
      }
    };

    fetchOrCreate().catch((err) => {
      console.error("[OPENY] NotificationPreferences error:", err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId]);

  const updateCategory = useCallback(
    async (category: string, channel: string, value: boolean) => {
      if (!rowId || !prefs) return;
      const sb = getSupabaseClient();
      const currentCategoryPrefs = (prefs[category] as Record<string, boolean>) ?? { inApp: true, push: false, email: false };
      const updated = { ...prefs, [category]: { ...currentCategoryPrefs, [channel]: value } };
      setPrefs(updated);
      await sb.from(TABLE).update({
        preferences: updated,
        updated_at: new Date().toISOString(),
      }).eq("id", rowId);
    },
    [rowId, prefs]
  );

  const effectivePrefs = useMemo(
    () => prefs ?? { id: "", userId, ...DEFAULT_PREFS, updatedAt: "" },
    [prefs, userId]
  );

  return { prefs: effectivePrefs, loading, updateCategory };
}
