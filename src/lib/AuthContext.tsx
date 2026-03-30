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
  useState,
  type ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  query,
  where,
  onSnapshot,
  limit,
} from "firebase/firestore";
import { auth, wsCol } from "@/lib/firebase";
import type { TeamMember, TeamRole } from "@/lib/types";

// ── Context shape ────────────────────────────────────────────

interface AuthContextValue {
  /** Firebase Auth user (null when signed out) */
  user: User | null;
  /** Firestore TeamMember record linked to the current user */
  member: TeamMember | null;
  /** Structured role derived from TeamMember.teamRole */
  role: TeamRole | null;
  loading: boolean;

  // ── Helpers ───────────────────────────────────────────────
  isAdmin: boolean;
  isAccountManager: boolean;
  isCreative: boolean;

  // ── Actions ───────────────────────────────────────────────
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<TeamMember | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setMember(null);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  // 2. When a user is signed in, look up their TeamMember record by email
  useEffect(() => {
    if (!user) return;

    const q = query(
      wsCol("team"),
      where("email", "==", user.email ?? ""),
      limit(1)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const doc = snap.docs[0];
          setMember({ id: doc.id, ...doc.data() } as TeamMember);
        } else {
          setMember(null);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [user]);

  // ── Actions ───────────────────────────────────────────────

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await fbSignOut(auth);
    setMember(null);
  }, []);

  // ── Derived role ──────────────────────────────────────────

  const role: TeamRole | null = member?.teamRole ?? null;
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

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
