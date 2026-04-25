'use client';

import type { ReactNode } from 'react';

export default function PermissionGate({
  children,
  fallback,
}: {
  children?: ReactNode;
  fallback?: ReactNode;
  [key: string]: any;
}) {
  return <>{children ?? fallback ?? null}</>;
}
