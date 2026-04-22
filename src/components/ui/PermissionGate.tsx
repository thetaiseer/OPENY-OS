'use client';

/**
 * PermissionGate
 *
 * Conditionally renders children based on the current user's module permissions.
 * Children are hidden (not rendered) when the user lacks the required access.
 *
 * Usage:
 *   <PermissionGate workspace="os" module="clients" required="full">
 *     <button>Add Client</button>
 *   </PermissionGate>
 *
 * Props:
 *   workspace  — 'os' | 'docs'
 *   module     — module key (e.g. 'clients', 'tasks', 'invoice')
 *   required   — 'read' (default) | 'full' | 'none'
 *   fallback   — optional element to show when access is denied (default: null)
 */

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { ModuleAccess, OsModule, DocsModule } from '@/lib/types';

interface PermissionGateProps {
  workspace: 'os' | 'docs';
  module: OsModule | DocsModule | string;
  required?: ModuleAccess;
  fallback?: ReactNode;
  children: ReactNode;
}

export default function PermissionGate({
  workspace,
  module,
  required = 'read',
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, loading } = usePermissions();

  // While loading, optimistically render children to avoid flicker.
  if (loading) return <>{children}</>;

  if (!can(workspace, module, required)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
