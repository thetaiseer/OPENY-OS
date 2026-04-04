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
    .from('users')
    .select('id, name, email, role, client_id')
    .eq('id', supabaseUser.id)
    .single();

  console.log('[auth] Profile query result — row:', data, '| error:', error ? `${error.code}: ${error.message}` : 'none');

  if (data) {
    const resolvedRole = (data.role as UserRole) || 'client';
    console.log('[auth] Resolved role from database:', resolvedRole);
    return {
      profileMissing: false,
      user: {
        id:        data.id,
        name:      data.name || supabaseUser.email?.split('@')[0] || '',
        email:     data.email || supabaseUser.email || '',
        role:      resolvedRole,
        client_id: data.client_id ?? null,
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
    // Load the initial session.
    supabase.auth.getUser().then(async ({ data: { user: sbUser } }) => {
      if (sbUser) {
        await loadProfile(sbUser);
      }
      setLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          await loadProfile(session.user);
        } else {
          setUser(LOADING_USER);
          setProfileMissing(false);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const signOut = async () => {
    console.log('[auth] Signing out…');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[auth] Sign out failed:', error.message);
      throw error;
    }
    console.log('[auth] Sign out successful — redirecting to /login');
    // Clear Supabase auth entries from localStorage before hard-navigating.
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-'))
        .forEach(k => localStorage.removeItem(k));
    } catch { /* ignore — storage may be unavailable */ }
    window.location.replace('/login');
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
  const clientId = (user as User & { client_id?: string | null }).client_id ?? null;

  return (
    <AuthContext.Provider value={{ user, role, clientId, loading, profileMissing, signOut, repairProfile, setRole: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
