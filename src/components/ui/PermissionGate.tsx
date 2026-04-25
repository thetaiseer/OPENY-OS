'use client';

import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { ModuleAccess } from '@/lib/types';

export default function PermissionGate({
  workspace,
  module,
  required = 'read',
  children,
  fallback,
}: {
  workspace: 'os' | 'docs';
  module: string;
  required?: ModuleAccess;
  children?: ReactNode;
  fallback?: ReactNode;
  [key: string]: unknown;
}) {
  const { can, loading } = usePermissions();
  if (loading) return null;
  return <>{can(workspace, module, required) ? children : (fallback ?? null)}</>;
}
