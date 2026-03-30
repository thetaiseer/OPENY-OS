"use client";

// ============================================================
// OPENY OS – UserPreferencesSync
// Invisible component that bridges Firebase Auth state with
// per-user UI preferences (theme, language) stored in
// Firestore so that they sync across ALL devices automatically.
//
// Placement: must be a descendant of both AuthProvider AND
// ThemeProvider/LanguageProvider (handled in layout.tsx).
// ============================================================
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useLanguage, type Language } from "@/lib/LanguageContext";
import {
  subscribeToUserPreferences,
  upsertUserPreferences,
} from "@/lib/firestore/userPreferences";

export function UserPreferencesSync() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

  // Track how many incoming Firestore-driven state updates are in
  // flight so the write-back effect doesn't echo them back to Firestore.
  const skipWrites = useRef(0);
  const syncedForUid = useRef<string | null>(null);

  // ── Step 1: Subscribe to Firestore prefs when user logs in ──
  useEffect(() => {
    if (!user) {
      syncedForUid.current = null;
      return;
    }

    const uid = user.uid;

    const unsub = subscribeToUserPreferences(
      uid,
      (prefs) => {
        // Only apply on first load for this session to avoid
        // overwriting user-initiated changes with stale data.
        if (syncedForUid.current === uid) return;
        syncedForUid.current = uid;

        if (!prefs) {
          // No prefs saved yet – write current device values to Firestore
          // so other devices get them too.
          upsertUserPreferences(uid, { theme, language }).catch((err) => {
            console.error("[OPENY:UserPreferencesSync] failed to initialise prefs:", err);
          });
          return;
        }

        // Apply saved preferences, incrementing the skip counter for
        // each state update we trigger so the write-back effect ignores
        // them (they came FROM Firestore, not from the user).
        if (prefs.theme && prefs.theme !== theme) {
          skipWrites.current += 1;
          setTheme(prefs.theme);
        }
        if (prefs.language && prefs.language !== language) {
          skipWrites.current += 1;
          setLanguage(prefs.language as Language);
        }
      }
    );

    return () => {
      unsub();
      syncedForUid.current = null;
    };
    // We intentionally exclude theme/language from deps here so the
    // subscription is only recreated when the logged-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Step 2: Write to Firestore when the user changes prefs ──
  useEffect(() => {
    // Not logged in → nothing to sync
    if (!user || syncedForUid.current !== user.uid) return;

    // This change was initiated by an incoming Firestore update – skip.
    if (skipWrites.current > 0) {
      skipWrites.current -= 1;
      return;
    }

    upsertUserPreferences(user.uid, { theme, language }).catch((err) => {
      console.error("[OPENY:UserPreferencesSync] failed to write prefs:", err);
    });
  }, [theme, language, user]);

  // This component renders nothing – it's a pure side-effect bridge.
  return null;
}
