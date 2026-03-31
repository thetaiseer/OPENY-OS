"use client";
 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Notification Preferences Hook (Firestore-backed)
// Phase 4: Advanced Notifications
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "./firebase";
import { useAuth } from "./AuthContext";





const DEFAULT_CHANNEL = {
  inApp: true,
  push: false,
  email: false,
};

const DEFAULT_PREFS = {
  approvals: { inApp: true, push: true, email: true },
  publishingReminders: { inApp: true, push: true, email: false },
  taskAlerts: { inApp: true, push: false, email: false },
  invitationEmails: { inApp: true, push: false, email: true },
  systemAlerts: { inApp: true, push: false, email: false },
  clientActions: { inApp: true, push: true, email: true },
};

// The admin user id used to scope notification preferences.
// const CURRENT_USER_ID = "thetaiseer@gmail.com"; // removed: now uses authenticated user

export function useNotificationPreferences() {
  const { user } = useAuth();
  const userId = _nullishCoalesce(_optionalChain([user, 'optionalAccess', _ => _.email]), () => ( ""));
  const [prefs, setPrefs] = useState(null);
  const [docId, setDocId] = useState(null);
  // Internal loading flag — only meaningful when userId is set.
  const [_loading, setLoading] = useState(true);
  // When there's no authenticated user there's nothing to load.
  const loading = userId ? _loading : false;

  useEffect(() => {
    // No user yet — return without calling setState in the effect body
    // (avoids the react-hooks/set-state-in-effect lint rule).
    if (!userId) return;

    const q = query(
      wsCol("userNotificationPreferences"),
      where("userId", "==", userId)
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (snap.empty) {
          // Create default preferences for this user
          const now = new Date().toISOString();
          const ref = await addDoc(
            wsCol("userNotificationPreferences"),
            {
              userId,
              ...DEFAULT_PREFS,
              updatedAt: now,
            }
          );
          setDocId(ref.id);
        } else {
          const d = snap.docs[0];
          setDocId(d.id);
          setPrefs({ id: d.id, ...d.data() } );
        }
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] NotificationPreferences listener error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId]);

  const updateCategory = useCallback(
    async (
      category


,
      channel,
      value
    ) => {
      if (!docId) return;
      const currentCategoryPrefs =
        _nullishCoalesce(_optionalChain([prefs, 'optionalAccess', _2 => _2[category]]), () => ( DEFAULT_CHANNEL));
      await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "userNotificationPreferences", docId), {
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
      _nullishCoalesce(prefs, () => ( {
        id: "",
        userId,
        ...DEFAULT_PREFS,
        updatedAt: "",
      })),
    [prefs, userId]
  );

  return { prefs: effectivePrefs, loading, updateCategory };
}
