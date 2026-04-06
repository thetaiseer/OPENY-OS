'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { createClient } from './supabase/client';
import type { User } from './types';

export type UserRole = 'admin' | 'team' | 'client';

const LOADING_USER: User = {
  id: '',
  name: '',
  email: '',
  role: 'client',
};

interface AuthContextType {
  user: User;
  role: UserRole;
  clientId: string | null;
  loading: boolean;
  profileMissing: boolean;
  signOut: () => Promise<void>;
  repairProfile: () => Promise<void>;
  /** @deprecated No-op in production. Role is determined by the database. */
  setRole: (role: UserRole, clientId?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: LOADING_USER,
  role: 'client',
  clientId: null,
  loading: true,
  profileMissing: false,
  signOut: async () => {},
  repairProfile: async () => {},
  setRole: () => {},
});

interface ProfileResult {
  user: User;
  profileMissing: boolean;
}

async function fetchUserProfile(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser,
): Promise<ProfileResult> {
  console.log('[auth] Fetching profile for auth user id:', supabaseUser.id, '| email:', supabaseUser.email);

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', supabaseUser.id)
    .single();

  console.log('[auth] Profile query result — row:', data, '| error:', error ? `${error.code}: ${error.message}` : 'none');

  if (data) {
    const resolvedRole = (data.role as UserRole) || 'client';
    console.log('[auth] Resolved role from database:', resolvedRole);
    return {
      profileMissing: false,
      user: {
        id:    data.id,
        name:  data.name || supabaseUser.email?.split('@')[0] || '',
        email: data.email || supabaseUser.email || '',
        role:  resolvedRole,
      },
    };
  }

  // Profile row not yet created — warn and return fallback until repaired.
  console.warn(
    '[auth] No profile row found for auth user id:', supabaseUser.id,
    '| email:', supabaseUser.email,
    '| query error:', error ? `${error.code}: ${error.message}` : 'row not found',
    '— profileMissing = true',
  );
  return {
    profileMissing: true,
    user: {
      id:    supabaseUser.id,
      name:  supabaseUser.user_metadata?.name ?? supabaseUser.email?.split('@')[0] ?? '',
      email: supabaseUser.email ?? '',
      role:  'client',
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Memoize the client so it is stable across re-renders.
  const supabase = useMemo(() => {
    const client = createClient();
    // Log the Supabase project URL once at boot so it is easy to verify the
    // correct project is connected in production logs.
    if (typeof window !== 'undefined') {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(not set)';
      const masked = url.replace(/^(https:\/\/[^.]{4})[^.]+/, '$1…');
      console.log('[auth] Supabase project URL:', masked);
    }
    return client;
  }, []);

  const [user, setUser]                   = useState<User>(LOADING_USER);
  const [loading, setLoading]             = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  // Shared helper: load profile for a given auth user and update state.
  const loadProfile = React.useCallback(
    async (sbUser: SupabaseUser) => {
      const result = await fetchUserProfile(supabase, sbUser);
      setUser(result.user);
      setProfileMissing(result.profileMissing);
      return result;
    },
    [supabase],
  );

  useEffect(() => {
    // `onAuthStateChange` fires `INITIAL_SESSION` as its very first event
    // (immediately, from the locally-cached token) — so we rely on it for both
    // the initial load and subsequent auth state changes.
    //
    // Previously there was an additional `getUser()` call here that caused two
    // concurrent `loadProfile` DB queries on every page load:
    //   1. from `getUser()` → `loadProfile`
    //   2. from `onAuthStateChange` `INITIAL_SESSION` → `loadProfile`
    // Removing the `getUser()` call eliminates that double fetch while keeping
    // the initial loading behaviour intact.
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          if (mounted) {
            setUser(LOADING_USER);
            setProfileMissing(false);
          }
        }
        if (mounted) setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const signOut = async () => {
    console.log('[auth] Signing out…');

    // Deactivate the current session in user_sessions before signing out so
    // the security page reflects the correct is_active = false state.
    // Non-blocking: a failure here must never prevent the user from signing out.
    try {
      console.log('[auth] Deactivating current session…');
      await fetch('/api/auth/sessions/deactivate-current', {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      console.warn('[auth] Session deactivation request failed — continuing with sign-out');
    }

    // Race the Supabase sign-out against a 5-second safety timeout so the user
    // is never left stuck on a "loading" sign-out if the network is unavailable.
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
      // Always clear Supabase auth entries and redirect, even if sign-out failed.
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('sb-'))
          .forEach(k => localStorage.removeItem(k));
      } catch { /* ignore — storage may be unavailable */ }
      console.log('[auth] Redirecting to /login');
      window.location.replace('/login');
    }
  };

  const repairProfile = async () => {
    console.log('[auth] Attempting profile self-repair…');
    const res = await fetch('/api/auth/repair-profile', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = (body as { error?: string }).error ?? `HTTP ${res.status}`;
      console.error('[auth] Profile repair failed:', msg);
      throw new Error(msg);
    }
    // Re-fetch the profile now that the row should exist.
    const { data: { user: sbUser } } = await supabase.auth.getUser();
    if (sbUser) {
      await loadProfile(sbUser);
    }
    console.log('[auth] Profile repair complete');
  };

  const role     = (user.role as UserRole) || 'client';
  const clientId = null;

  return (
    <AuthContext.Provider value={{ user, role, clientId, loading, profileMissing, signOut, repairProfile, setRole: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
