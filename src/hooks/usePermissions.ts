'use client';

/**
 * src/hooks/usePermissions.ts
 *
 * React hook that resolves the current user's effective permissions
 * from their role and stored module overrides.
 *
 * Usage:
 *   const { permissions, loading, can } = usePermissions();
 *   if (can('os', 'clients', 'full')) { ... }
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { resolveEffectivePermissions, normalizePlatformRole, hasModuleAccess } from '@/lib/permissions';
import type { MemberPermissions, ModuleAccess, OsModule, DocsModule } from '@/lib/types';

export interface UsePermissionsResult {
  /** Resolved effective permissions (role + per-module access) */
  permissions: MemberPermissions | null;
  /** True while the permission overrides are being fetched */
  loading: boolean;
  /**
   * Convenience checker — returns true if the user has at least the
   * required access level for the given workspace + module.
   *
   * Owner/admin always return true; members check resolved access.
   */
  can: (workspace: 'os' | 'docs', module: OsModule | DocsModule | string, required?: ModuleAccess) => boolean;
  /** True if the user can navigate to / view a module (read or full) */
  canView: (workspace: 'os' | 'docs', module: OsModule | DocsModule | string) => boolean;
  /** True if the user can perform write actions in a module */
  canWrite: (workspace: 'os' | 'docs', module: OsModule | DocsModule | string) => boolean;
}

export function usePermissions(): UsePermissionsResult {
  const { role, user } = useAuth();
  const platformRole = normalizePlatformRole(role);
  // Extract stable primitive to use in effect dependency
  const userId = user.id;

  const [permissions, setPermissions] = useState<MemberPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Owner/admin have full access by default — no need to fetch overrides.
    if (platformRole === 'owner' || platformRole === 'admin') {
      setPermissions(resolveEffectivePermissions(platformRole, []));
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPermissions() {
      setLoading(true);
      try {
        // Fetch resolved permissions from the API.
        const res = await fetch('/api/team/members/me/permissions', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) {
            setPermissions(resolveEffectivePermissions(platformRole, []));
          }
          return;
        }
        const data = await res.json() as { permissions?: MemberPermissions };
        if (!cancelled && data.permissions) {
          setPermissions(data.permissions);
        } else if (!cancelled) {
          setPermissions(resolveEffectivePermissions(platformRole, []));
        }
      } catch {
        if (!cancelled) {
          setPermissions(resolveEffectivePermissions(platformRole, []));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPermissions();
    return () => { cancelled = true; };
  }, [platformRole, userId]);  // re-run when role or auth user changes

  const can = useCallback(
    (workspace: 'os' | 'docs', module: OsModule | DocsModule | string, required: ModuleAccess = 'read'): boolean => {
      if (!permissions) return false;
      return hasModuleAccess(permissions, workspace, module, required);
    },
    [permissions],
  );

  const canView = useCallback(
    (workspace: 'os' | 'docs', module: OsModule | DocsModule | string): boolean =>
      can(workspace, module, 'read'),
    [can],
  );

  const canWrite = useCallback(
    (workspace: 'os' | 'docs', module: OsModule | DocsModule | string): boolean =>
      can(workspace, module, 'full'),
    [can],
  );

  return { permissions, loading, can, canView, canWrite };
}
