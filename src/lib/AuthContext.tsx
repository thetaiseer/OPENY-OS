"use client";

// ============================================================
// OPENY OS – Supabase Auth Context
// Wraps Supabase Authentication and exposes the current user,
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
import { getSupabaseClient } from "@/lib/supabase/client";
import { getTeamMemberByEmail, createTeamMember as sbCreateTeamMember } from "@/lib/supabase/team";

// ── Super-admin email ────────────────────────────────────────
// This email always receives the "admin" teamRole on first login.
const SUPER_ADMIN_EMAIL = "thetaiseer@gmail.com";
const SUPER_ADMIN_INITIALS = "AD";
const SUPER_ADMIN_COLOR = "#4f8ef7";

const AuthContext = createContext(null);

// ── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Listen for Supabase Auth state changes.
  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) {
      setLoading(false);
      return;
    }

    // Get initial session
    sb.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) setLoading(false);
    });

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setMember(null);
        setLoading(false);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  // 2. When a user is signed in, look up their TeamMember record by email.
  //    If none exists and the email is the super-admin, auto-create it.
  useEffect(() => {
    if (!user) return;

    const email = user.email ?? "";
    let cancelled = false;

    async function syncMember() {
      const existing = await getTeamMemberByEmail(email);
      if (cancelled) return;

      if (existing) {
        setMember(existing);
        setLoading(false);
      } else if (email === SUPER_ADMIN_EMAIL) {
        // Auto-bootstrap the super-admin TeamMember record
        try {
          const now = new Date().toISOString();
          await sbCreateTeamMember({
            name: "Admin",
            email: SUPER_ADMIN_EMAIL,
            role: "System Administrator",
            teamRole: "admin",
            status: "active",
            initials: SUPER_ADMIN_INITIALS,
            color: SUPER_ADMIN_COLOR,
            createdAt: now,
            updatedAt: now,
          });
          // Re-fetch after creation
          const created = await getTeamMemberByEmail(email);
          if (!cancelled) { setMember(created); setLoading(false); }
        } catch (err) {
          console.error("[OPENY:AuthContext] Failed to bootstrap admin member:", err);
          if (!cancelled) setLoading(false);
        }
      } else {
        setMember(null);
        setLoading(false);
      }
    }

    syncMember();
    return () => { cancelled = true; };
  }, [user]);

  // ── Actions ───────────────────────────────────────────────

  const signIn = useCallback(async (email, password) => {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("Supabase is not initialised – check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabaseClient();
    if (!sb) return;
    await sb.auth.signOut();
    setMember(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const sb = getSupabaseClient();
    if (!sb) throw new Error("Supabase is not initialised – check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/login`
      : undefined;
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  }, []);

  // ── Derived role ──────────────────────────────────────────

  const role = (member as any)?.teamRole ?? null;
  const isAdmin = role === "admin";
  const isAccountManager = role === "account_manager";
  const isCreative = role === "creative";

  const value = useMemo(
    () => ({ user, member, role, loading, isAdmin, isAccountManager, isCreative, signIn, signOut, resetPassword }),
    [user, member, role, loading, isAdmin, isAccountManager, isCreative, signIn, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Consumer hook ─────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
