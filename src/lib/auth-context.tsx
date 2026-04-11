'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import type { User } from './types';

export type UserRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

/** Email address that always resolves to the 'owner' role. Configurable via NEXT_PUBLIC_OWNER_EMAIL env var. */
const OWNER_EMAIL = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? 'thetaiseer@gmail.com').toLowerCase();

/** Resolve the workspace role for the given email, overriding with 'owner' for the owner email. */
function resolveRoleForEmail(email: string, storedRole?: string): string {
  if (email.toLowerCase() === OWNER_EMAIL) return 'owner';
  return storedRole ?? 'member';
}

/** Map legacy role values to the current RBAC role set. */
export function normalizeRole(raw: string): UserRole {
  switch (raw) {
    case 'owner':   return 'owner';
    case 'admin':   return 'admin';
    case 'manager': return 'manager';
    case 'team':    return 'member';
    case 'member':  return 'member';
    case 'viewer':  return 'viewer';
    case 'client':  return 'viewer';
    default:        return 'viewer';
  }
}

const LOADING_USER: User = {
  id: '',
  name: '',
  email: '',
  role: 'viewer',
};

interface AuthContextType {
  user: User;
  role: UserRole;
  clientId: string | null;
  loading: boolean;
  /** @deprecated Always false. Kept for backwards compatibility. */
  profileMissing: boolean;
  signOut: () => Promise<void>;
  /** @deprecated No-op. Kept for backwards compatibility. */
  repairProfile: () => Promise<void>;
  /** @deprecated No-op in production. Role is determined by the database. */
  setRole: (role: UserRole, clientId?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: LOADING_USER,
  role: 'viewer',
  clientId: null,
  loading: true,
  profileMissing: false,
  signOut: async () => {},
  repairProfile: async () => {},
  setRole: () => {},
});

type TeamMemberRow = {
  id: string;
  full_name: string;
  email: string;
  permission_role: string;
  status?: string;
} | null;

async function fetchUserFromTeamMembers(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser,
): Promise<User> {
  const email = supabaseUser.email ?? '';
  console.log('[auth] Fetching team member for email:', email);

  let data: TeamMemberRow = null;

  try {
    const result = await Promise.race([
      supabase
        .from('team_members')
        .select('id, full_name, email, permission_role, status')
        .eq('email', email)
        .eq('status', 'active')
        .maybeSingle() as unknown as Promise<{ data: TeamMemberRow; error: unknown }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('team-member-fetch-timeout')), 6_000),
      ),
    ]);
    data = result.data;
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'team-member-fetch-timeout';
    console.warn('[auth] Team member fetch', isTimeout ? 'timed out' : 'threw:', err);
  }

  if (data) {
    // The owner email always resolves to 'owner' regardless of the stored role.
    const resolvedRole = normalizeRole(resolveRoleForEmail(email, data.permission_role));
    console.log('[auth] Team member found — role:', resolvedRole);
    return {
      id:     supabaseUser.id,
      name:   data.full_name || email.split('@')[0],
      email:  data.email || email,
      role:   resolvedRole,
      status: (data.status as User['status']) ?? 'active',
    };
  }

  // No active team_members row — attempt auto-creation via the ensure-member API.
  console.log('[auth] No team_members row found for email:', email, '— attempting auto-create');
  try {
    const res = await fetch('/api/auth/ensure-member', { method: 'POST', credentials: 'include' });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      const member = (body as { member?: TeamMemberRow }).member;
      if (member) {
        const resolvedRole = normalizeRole(resolveRoleForEmail(email, member.permission_role));
        console.log('[auth] Auto-created team member — role:', resolvedRole);
        return {
          id:     supabaseUser.id,
          name:   member.full_name || email.split('@')[0],
          email:  member.email || email,
          role:   resolvedRole,
          status: 'active',
        };
      }
    } else {
      console.warn('[auth] ensure-member API returned', res.status);
    }
  } catch (err) {
    console.warn('[auth] ensure-member request failed:', err);
  }

  // Final fallback: use auth user metadata with a default role.
  const fallbackRole = resolveRoleForEmail(email);
  console.warn('[auth] Falling back to default role:', fallbackRole, 'for email:', email);
  return {
    id:    supabaseUser.id,
    name:  supabaseUser.user_metadata?.name ?? email.split('@')[0] ?? '',
    email,
    role:  fallbackRole,
    status: 'active',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Memoize the client so it is stable across re-renders.
  const supabase = useMemo(() => {
    const client = createClient();
    if (typeof window !== 'undefined') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)';
      const masked = url.replace(/^(https:\/\/[^.]{4})[^.]+/, '$1…');
      console.log('[auth] Supabase project URL:', masked);
    }
    return client;
  }, []);

  const [user, setUser]   = useState<User>(LOADING_USER);
  const [loading, setLoading] = useState(true);

  const loadIdentity = React.useCallback(
    async (sbUser: SupabaseUser) => {
      const resolved = await fetchUserFromTeamMembers(supabase, sbUser);
      setUser(resolved);
      return resolved;
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;

    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn('[auth] Safety timeout reached — clearing loading state');
        setLoading(false);
      }
    }, 8_000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        clearTimeout(safetyTimer);
        if (session?.user) {
          await loadIdentity(session.user);
        } else {
          if (mounted) setUser(LOADING_USER);
        }
        if (mounted) setLoading(false);
      },
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [supabase, loadIdentity]);

  const signOut = async () => {
    console.log('[auth] Signing out…');

    try {
      console.log('[auth] Deactivating current session…');
      await fetch('/api/auth/sessions/deactivate-current', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      console.warn('[auth] Session deactivation request failed — continuing with sign-out');
    }

    try {
      const result = await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('sign-out-timeout')), 5_000),
        ),
      ]);
      if (result.error) {
        console.error('[auth] Sign out error:', result.error.message);
      } else {
        console.log('[auth] Sign out successful');
      }
    } catch (err) {
      const isTimeout = err instanceof Error && err.message === 'sign-out-timeout';
      if (isTimeout) {
        console.warn('[auth] Sign out timed out — redirecting anyway');
      } else {
        console.error('[auth] Sign out failed:', err);
      }
    } finally {
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k));
      } catch { /* ignore — storage may be unavailable */ }
      console.log('[auth] Redirecting to /login');
      window.location.replace('/login');
    }
  };

  const role     = normalizeRole(user.role ?? '') as UserRole;
  const clientId = null;

  return (
    <AuthContext.Provider value={{
      user,
      role,
      clientId,
      loading,
      profileMissing: false,
      signOut,
      repairProfile: async () => {},
      setRole: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
