'use client';

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@/lib/types';
import { OWNER_EMAIL } from '@/lib/constants/auth';
import {
  mapWorkspaceRoleToUserRole,
  type WorkspaceKey,
  type WorkspaceRole,
} from '@/lib/workspace-access';

export type UserRole = 'owner' | 'admin' | 'manager' | 'team_member' | 'viewer' | 'client';

// Email that always resolves to the 'owner' role — the workspace owner.
// ── Session-scoped user cache ─────────────────────────────────────────────────
// Caches the resolved user profile in sessionStorage so that subsequent page
// loads within the same browser session skip the team_members DB round-trip and
// show the app shell immediately.
const CACHE_KEY = 'openy_user_v1';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface WorkspaceAccessState {
  os: boolean;
  docs: boolean;
  roles: Partial<Record<WorkspaceKey, WorkspaceRole>>;
  isGlobalOwner: boolean;
}

interface CachedUserEntry {
  user: User;
  workspaceAccess: WorkspaceAccessState;
  ts: number;
}

function readUserCache(): { user: User; workspaceAccess: WorkspaceAccessState } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedUserEntry;
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return { user: entry.user, workspaceAccess: entry.workspaceAccess };
  } catch {
    return null;
  }
}

function writeUserCache(user: User, workspaceAccess: WorkspaceAccessState): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedUserEntry = { user, workspaceAccess, ts: Date.now() };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* ignore — storage quota or private-mode */
  }
}

function clearUserCache(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

const LOADING_USER: User = {
  id: '',
  name: '',
  email: '',
  role: 'team_member',
};

interface AuthContextType {
  user: User;
  role: UserRole;
  workspaceAccess: WorkspaceAccessState;
  clientId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  hasWorkspaceAccess: (workspace: WorkspaceKey) => boolean;
  /** @deprecated No-op. Role is determined by the team_members table. */
  setRole: (role: UserRole, clientId?: string) => void;
}

const DEFAULT_WORKSPACE_ACCESS: WorkspaceAccessState = {
  os: false,
  docs: false,
  roles: {},
  isGlobalOwner: false,
};

const AuthContext = createContext<AuthContextType>({
  user: LOADING_USER,
  role: 'team_member',
  workspaceAccess: DEFAULT_WORKSPACE_ACCESS,
  clientId: null,
  loading: true,
  signOut: async () => {},
  hasWorkspaceAccess: () => false,
  setRole: () => {},
});

async function fetchUserStateFromTables(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser,
): Promise<{ user: User; workspaceAccess: WorkspaceAccessState }> {
  const email = supabaseUser.email ?? '';

  // Force owner role for the workspace owner email without a DB round-trip.
  if (email.toLowerCase() === OWNER_EMAIL) {
    return {
      user: {
        id: supabaseUser.id,
        name: supabaseUser.user_metadata?.name ?? email.split('@')[0] ?? '',
        email,
        role: 'owner',
      },
      workspaceAccess: {
        os: true,
        docs: true,
        roles: { os: 'owner', docs: 'owner' },
        isGlobalOwner: true,
      },
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
        setTimeout(() => reject(new Error('team-member-fetch-timeout')), 3_000),
      ),
    ]);
    data = result.data;
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === 'team-member-fetch-timeout';
    console.warn('[auth] team_members fetch', isTimeout ? 'timed out' : 'threw:', err);
  }

  const { data: memberships } = await supabase
    .from('workspace_memberships')
    .select('workspace_key, role, is_active')
    .eq('user_id', supabaseUser.id)
    .eq('is_active', true);

  const workspaceAccess: WorkspaceAccessState = {
    os: false,
    docs: false,
    roles: {},
    isGlobalOwner: false,
  };
  for (const membership of memberships ?? []) {
    const key = membership.workspace_key as WorkspaceKey;
    if (key === 'os' || key === 'docs') {
      workspaceAccess[key] = true;
      workspaceAccess.roles[key] = membership.role as WorkspaceRole;
    }
  }

  if (data) {
    const resolvedRole = (data.role as UserRole) || 'team_member';
    return {
      user: {
        id: supabaseUser.id,
        name: data.full_name || email.split('@')[0] || '',
        email: data.email || email,
        role: resolvedRole,
      },
      workspaceAccess,
    };
  }

  const docsOnlyRole = mapWorkspaceRoleToUserRole(
    (workspaceAccess.roles.docs ?? 'viewer') as WorkspaceRole,
  );
  const osFallbackRole = mapWorkspaceRoleToUserRole(
    (workspaceAccess.roles.os ?? 'member') as WorkspaceRole,
  );
  const fallbackRole =
    workspaceAccess.docs && !workspaceAccess.os
      ? docsOnlyRole
      : workspaceAccess.os
        ? osFallbackRole
        : 'viewer';
  console.warn(
    '[auth] No team_member row found for email:',
    email,
    '— defaulting role to',
    fallbackRole,
  );
  return {
    user: {
      id: supabaseUser.id,
      name: supabaseUser.user_metadata?.name ?? email.split('@')[0] ?? '',
      email,
      role: fallbackRole,
    },
    workspaceAccess,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => {
    const client = createClient();
    return client;
  }, []);

  // Seed state from sessionStorage cache so the UI renders immediately on
  // repeat page loads without waiting for the DB round-trip.
  // A single useState lazy initializer reads the cache once; subsequent
  // state calls reuse the already-computed value.
  const [initCache] = useState<{ user: User; workspaceAccess: WorkspaceAccessState } | null>(
    readUserCache,
  );
  const [user, setUser] = useState<User>(initCache?.user ?? LOADING_USER);
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessState>(
    initCache?.workspaceAccess ?? DEFAULT_WORKSPACE_ACCESS,
  );
  const [loading, setLoading] = useState<boolean>(initCache === null);
  // Keep a stable ref so the effect below can read the initial cache status
  // without closing over stale state.
  const initCacheRef = useRef(initCache);

  const loadUser = React.useCallback(
    async (sbUser: SupabaseUser) => {
      const resolved = await fetchUserStateFromTables(supabase, sbUser);
      setUser(resolved.user);
      setWorkspaceAccess(resolved.workspaceAccess);
      writeUserCache(resolved.user, resolved.workspaceAccess);
      return resolved.user;
    },
    [supabase],
  );

  useEffect(() => {
    let mounted = true;
    // Use the ref to avoid re-reading sessionStorage inside the effect.
    const hadCache = initCacheRef.current !== null;

    // Only set a safety timer if we don't already have cached data.
    const safetyTimer = !hadCache
      ? setTimeout(() => {
          if (mounted) {
            console.warn('[auth] Safety timeout reached — clearing loading state');
            setLoading(false);
          }
        }, 5_000)
      : null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (session?.user) {
        if (hadCache) {
          // We rendered immediately from cache — re-validate in background
          // without blocking the UI again.
          loadUser(session.user).catch((err) => {
            console.warn(
              '[auth] Background user refresh failed for user',
              session.user.id,
              ':',
              err,
            );
          });
        } else {
          await loadUser(session.user);
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) {
          setUser(LOADING_USER);
          setWorkspaceAccess(DEFAULT_WORKSPACE_ACCESS);
          clearUserCache();
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      if (safetyTimer) clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [supabase, loadUser]);

  const signOut = async () => {
    clearUserCache();

    try {
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
          .filter((k) => k.startsWith('sb-'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore — storage may be unavailable */
      }
      router.replace('/');
    }
  };

  const role = (user.role as UserRole) || 'team_member';
  const clientId = null;
  const hasWorkspaceAccess = (workspace: WorkspaceKey) => workspaceAccess[workspace];

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        workspaceAccess,
        clientId,
        loading,
        signOut,
        hasWorkspaceAccess,
        setRole: () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
