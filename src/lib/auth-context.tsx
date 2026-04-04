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
  signOut: () => Promise<void>;
  /** @deprecated No-op in production. Role is determined by the database. */
  setRole: (role: UserRole, clientId?: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: LOADING_USER,
  role: 'client',
  clientId: null,
  loading: true,
  signOut: async () => {},
  setRole: () => {},
});

async function fetchUserProfile(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser,
): Promise<User> {
  const { data } = await supabase
    .from('users')
    .select('id, name, email, role, client_id')
    .eq('id', supabaseUser.id)
    .single();

  if (data) {
    return {
      id:        data.id,
      name:      data.name || supabaseUser.email?.split('@')[0] || '',
      email:     data.email || supabaseUser.email || '',
      role:      (data.role as UserRole) || 'client',
      client_id: data.client_id ?? null,
    };
  }

  // Profile row not yet created — return sensible defaults.
  return {
    id:    supabaseUser.id,
    name:  supabaseUser.user_metadata?.name ?? supabaseUser.email?.split('@')[0] ?? '',
    email: supabaseUser.email ?? '',
    role:  'client',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Memoize the client so it is stable across re-renders.
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser]       = useState<User>(LOADING_USER);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load the initial session.
    supabase.auth.getUser().then(async ({ data: { user: sbUser } }) => {
      if (sbUser) {
        const profile = await fetchUserProfile(supabase, sbUser);
        setUser(profile);
      }
      setLoading(false);
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const profile = await fetchUserProfile(supabase, session.user);
          setUser(profile);
        } else {
          setUser(LOADING_USER);
        }
        setLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const role     = (user.role as UserRole) || 'client';
  const clientId = (user as User & { client_id?: string | null }).client_id ?? null;

  return (
    <AuthContext.Provider value={{ user, role, clientId, loading, signOut, setRole: () => {} }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
