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
  console.log('[auth] Fetching profile for auth user id:', supabaseUser.id);

  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, role, client_id')
    .eq('id', supabaseUser.id)
    .single();

  console.log('[auth] Fetched profile row:', data, error ? `error: ${error.message}` : '');

  if (data) {
    const resolvedRole = (data.role as UserRole) || 'client';
    console.log('[auth] Resolved role:', resolvedRole);
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

  // Profile row not yet created — warn and return fallback.
  console.warn('[auth] No profile row found for user id:', supabaseUser.id, '— defaulting role to client');
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
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser]                   = useState<User>(LOADING_USER);
  const [loading, setLoading]             = useState(true);
  const [profileMissing, setProfileMissing] = useState(false);

  useEffect(() => {
    // Load the initial session.
    supabase.auth.getUser().then(async ({ data: { user: sbUser } }) => {
      if (sbUser) {
        const result = await fetchUserProfile(supabase, sbUser);
        setUser(result.user);
        setProfileMissing(result.profileMissing);
      }
      setLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const result = await fetchUserProfile(supabase, session.user);
          setUser(result.user);
          setProfileMissing(result.profileMissing);
        } else {
          setUser(LOADING_USER);
          setProfileMissing(false);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    console.log('[auth] Signing out…');
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[auth] Sign out failed:', error.message);
      throw error;
    }
    console.log('[auth] Sign out successful — redirecting to /login');
    window.location.href = '/login';
  };

  const role     = (user.role as UserRole) || 'client';
  const clientId = (user as User & { client_id?: string | null }).client_id ?? null;

  return (
    <AuthContext.Provider value={{ user, role, clientId, loading, profileMissing, signOut, setRole: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
