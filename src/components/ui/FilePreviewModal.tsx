'use client';

import type { ReactNode } from 'react';

export default function FilePreviewModal({
  open = false,
  children,
}: {
  open?: boolean;
  children?: ReactNode;
  [key: string]: any;
}) {
  if (!open) return null;
  return <div>{children}</div>;
}
