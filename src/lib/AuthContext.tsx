"use client";

// ============================================================
// OPENY OS – Firebase Auth Context
// Wraps Firebase Authentication and exposes the current user,
// their linked TeamMember record, and role-based helpers.
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
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged } from

"firebase/auth";
import {
  addDoc,
  query,
  where,
  onSnapshot,
  limit } from
"firebase/firestore";
import { auth, wsCol } from "@/lib/firebase";

// ── Super-admin email ────────────────────────────────────────
// This email always receives the "admin" teamRole on first login.
const SUPER_ADMIN_EMAIL = "thetaiseer@gmail.com";


// ── Context shape ────────────────────────────────────────────




















const AuthContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for Firebase Auth state changes.
  // Guard against null auth (happens when NEXT_PUBLIC_FIREBASE_* env vars are
  // missing/invalid and createAuth() in firebase/client.ts returned null).
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setMember(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // 2. When a user is signed in, look up their TeamMember record by email.
  //    If none exists and the email is the super-admin, auto-create it.
  useEffect(() => {
    if (!user) return;

    const email = user.email ?? "";

    const q = query(
      wsCol("team"),
      where("email", "==", email),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      async (snap) => {
        if (!snap.empty) {
          const docSnap = snap.docs[0];
          setMember({ id: docSnap.id, ...docSnap.data() });
          setLoading(false);
        } else if (email === SUPER_ADMIN_EMAIL) {
          // Auto-bootstrap the super-admin TeamMember record
          try {
            const now = new Date().toISOString();
            await addDoc(wsCol("team"), {
              name: "Admin",
              email: SUPER_ADMIN_EMAIL,
              role: "System Administrator",
              teamRole: "admin",
              status: "active",
              createdAt: now,
              updatedAt: now,
            });
            // onSnapshot will fire again and pick up the new doc
          } catch (err) {
            console.error("[OPENY:AuthContext] Failed to bootstrap admin member:", err);
            setLoading(false);
          }
        } else {
          setMember(null);
          setLoading(false);
        }
      },
      () => setLoading(false)
    );

    return unsub;
  }, [user]);

  // ── Actions ───────────────────────────────────────────────

  const signIn = useCallback(async (email, password) => {
    if (!auth) throw new Error("Firebase Auth is not initialised – check NEXT_PUBLIC_FIREBASE_* env vars.");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await fbSignOut(auth);
    setMember(null);
  }, []);

  // ── Derived role ──────────────────────────────────────────

  const role = member?.teamRole ?? null;
  const isAdmin = role === "admin";
  const isAccountManager = role === "account_manager";
  const isCreative = role === "creative";

  const value = useMemo(
    () => ({ user, member, role, loading, isAdmin, isAccountManager, isCreative, signIn, signOut }),
    [user, member, role, loading, isAdmin, isAccountManager, isCreative, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Consumer hook ─────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}