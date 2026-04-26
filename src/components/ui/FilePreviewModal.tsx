'use client';

import type { ReactNode } from 'react';

export default function FilePreviewModal({
  open = false,
  children,
}: {
  open?: boolean;
  children?: ReactNode;
} & Record<string, unknown>) {
  if (!open) return null;
  return <div>{children}</div>;
}
