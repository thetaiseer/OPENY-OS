'use client';

import type { ReactNode } from 'react';

export default function PermissionGate({
  children,
  fallback,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
} & Record<string, unknown>) {
  return <>{children ?? fallback ?? null}</>;
}
