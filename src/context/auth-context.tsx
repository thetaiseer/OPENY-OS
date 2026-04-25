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
  defaultWorkspaceId?: string | null;
  ts: number;
}

function readUserCache(): {
  user: User;
  workspaceAccess: WorkspaceAccessState;
  defaultWorkspaceId: string | null;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CachedUserEntry;
    if (Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return {
      user: entry.user,
      workspaceAccess: entry.workspaceAccess,
      defaultWorkspaceId: entry.defaultWorkspaceId ?? null,
    };
  } catch {
    return null;
  }
}

function writeUserCache(
  user: User,
  workspaceAccess: WorkspaceAccessState,
  defaultWorkspaceId: string | null,
): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedUserEntry = { user, workspaceAccess, defaultWorkspaceId, ts: Date.now() };
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
  /** First workspace_members.workspace_id for API scoping (unified app). */
  defaultWorkspaceId: string | null;
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
  defaultWorkspaceId: null,
  clientId: null,
  loading: true,
  signOut: async () => {},
  hasWorkspaceAccess: () => false,
  setRole: () => {},
});

function pickDisplayName(
  profile: { full_name?: string | null; name?: string | null } | null,
  teamMemberFullName: string | null | undefined,
  metadata: Record<string, unknown>,
  email: string,
): string {
  const pf = profile?.full_name?.trim();
  if (pf) return pf;
  const pn = profile?.name?.trim();
  if (pn) return pn;
  const tf = teamMemberFullName?.trim();
  if (tf) return tf;
  const mf = typeof metadata.full_name === 'string' ? (metadata.full_name as string).trim() : '';
  if (mf) return mf;
  const mn = typeof metadata.name === 'string' ? (metadata.name as string).trim() : '';
  if (mn) return mn;
  const local = email.split('@')[0];
  return local || 'there';
}

async function fetchUserStateFromTables(
  supabase: ReturnType<typeof createClient>,
  supabaseUser: SupabaseUser,
): Promise<{
  user: User;
  workspaceAccess: WorkspaceAccessState;
  defaultWorkspaceId: string | null;
}> {
  const email = supabaseUser.email ?? '';
  const meta = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>;

  const [profileRes, memberWsRes] = await Promise.all([
    supabase.from('profiles').select('name, full_name').eq('id', supabaseUser.id).maybeSingle(),
    supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', supabaseUser.id)
      .limit(1)
      .maybeSingle(),
  ]);

  let profile: { full_name?: string | null; name?: string | null } | null = null;
  if (!profileRes.error && profileRes.data) {
    profile = profileRes.data as { full_name?: string | null; name?: string | null };
  }

  const defaultWorkspaceId =
    !memberWsRes.error && memberWsRes.data?.workspace_id
      ? (memberWsRes.data.workspace_id as string)
      : null;

  // Force owner role for the workspace owner email without a DB round-trip.
  if (email.toLowerCase() === OWNER_EMAIL) {
    return {
      user: {
        id: supabaseUser.id,
        name: pickDisplayName(profile, null, meta, email),
        email,
        role: 'owner',
      },
      workspaceAccess: {
        os: true,
        docs: true,
        roles: { os: 'owner', docs: 'owner' },
        isGlobalOwner: true,
      },
      defaultWorkspaceId,
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
  } catch {
    /* team_members lookup timed out or failed */
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
        name: pickDisplayName(profile, data.full_name, meta, email),
        email: data.email || email,
        role: resolvedRole,
      },
      workspaceAccess,
      defaultWorkspaceId,
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
  return {
    user: {
      id: supabaseUser.id,
      name: pickDisplayName(profile, null, meta, email),
      email,
      role: fallbackRole,
    },
    workspaceAccess,
    defaultWorkspaceId,
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
  const [initCache] = useState<{
    user: User;
    workspaceAccess: WorkspaceAccessState;
    defaultWorkspaceId: string | null;
  } | null>(readUserCache);
  const [user, setUser] = useState<User>(initCache?.user ?? LOADING_USER);
  const [workspaceAccess, setWorkspaceAccess] = useState<WorkspaceAccessState>(
    initCache?.workspaceAccess ?? DEFAULT_WORKSPACE_ACCESS,
  );
  const [defaultWorkspaceId, setDefaultWorkspaceId] = useState<string | null>(
    initCache?.defaultWorkspaceId ?? null,
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
      setDefaultWorkspaceId(resolved.defaultWorkspaceId);
      writeUserCache(resolved.user, resolved.workspaceAccess, resolved.defaultWorkspaceId);
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
          loadUser(session.user).catch(() => {});
        } else {
          await loadUser(session.user);
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) {
          setUser(LOADING_USER);
          setWorkspaceAccess(DEFAULT_WORKSPACE_ACCESS);
          setDefaultWorkspaceId(null);
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
      /* continue sign-out */
    }

    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('sign-out-timeout')), 5_000),
        ),
      ]);
    } catch {
      /* sign-out timeout or failure — still clear session below */
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
        defaultWorkspaceId,
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
