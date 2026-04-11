'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import type { User } from './types';

export type UserRole = 'owner' | 'admin' | 'manager' | 'team' | 'client';

// Email that always resolves to the 'owner' role — the workspace owner.
const OWNER_EMAIL = 'thetaiseer@gmail.com';

const LOADING_USER: User = {
  id: '',
  name: '',
  email: '',
  role: 'team',
};

interface AuthContextType {
  user: User;
  role: UserRole;
  clientId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** @deprecated No-op. Role is determined by the team_members table. */
  setRole: (role: UserRole, clientId?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: LOADING_USER,
  role: 'team',
  clientId: null,
  loading: true,
  signOut: async () => {},
  setRole: () => {},
});

async function fetchUserFromTeamMembers(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser,
): Promise<User> {
  const email = supabaseUser.email ?? '';
  console.log('[auth] Fetching team_member for email:', email);

  // Force owner role for the workspace owner email without a DB round-trip.
  if (email.toLowerCase() === OWNER_EMAIL) {
    console.log('[auth] Owner email detected — role forced to owner');
    return {
      id:    supabaseUser.id,
      name:  supabaseUser.user_metadata?.name ?? email.split('@')[0] ?? '',
      email,
      role:  'owner',
    };
  }

  type MemberRow = { id: string; full_name: string; email: string; role: string } | null;
  let data: MemberRow = null;

  try {
    const result = await Promise.race([
      supabase
        .from('team_members')
        .select('id, full_name, email, role')
        .eq('email', email)
        .maybeSingle() as unknown as Promise<{
          data: MemberRow;
          error: { code: string; message: string } | null;
        }>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('team-member-fetch-timeout')), 6_000),
      ),
    ]);
    data = result.data;
    const error = result.error;
    console.log('[auth] team_members query — row:', data, '| error:', error ? `${error.code}: ${error.message}` : 'none');
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'team-member-fetch-timeout';
    console.warn('[auth] team_members fetch', isTimeout ? 'timed out' : 'threw:', err);
  }

  if (data) {
    const resolvedRole = (data.role as UserRole) || 'team';
    console.log('[auth] Resolved role from team_members:', resolvedRole);
    return {
      id:    supabaseUser.id,
      name:  data.full_name || email.split('@')[0] || '',
      email: data.email || email,
      role:  resolvedRole,
    };
  }

  // No team_member row found — return a safe fallback.
  console.warn('[auth] No team_member row found for email:', email, '— defaulting to team role');
  return {
    id:    supabaseUser.id,
    name:  supabaseUser.user_metadata?.name ?? email.split('@')[0] ?? '',
    email,
    role:  'team',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => {
    const client = createClient();
    if (typeof window !== 'undefined') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)';
      const masked = url.replace(/^(https:\/\/[^.]{4})[^.]+/, '$1…');
      console.log('[auth] Supabase project URL:', masked);
    }
    return client;
  }, []);

  const [user, setUser]       = useState<User>(LOADING_USER);
  const [loading, setLoading] = useState(true);

  const loadUser = React.useCallback(
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
          await loadUser(session.user);
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
  }, [supabase, loadUser]);

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

  const role     = (user.role as UserRole) || 'team';
  const clientId = null;

  return (
    <AuthContext.Provider value={{ user, role, clientId, loading, signOut, setRole: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
