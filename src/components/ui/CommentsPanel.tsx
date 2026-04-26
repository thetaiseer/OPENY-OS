'use client';

import type { ReactNode } from 'react';

export default function CommentsPanel({
  children,
}: { children?: ReactNode } & Record<string, unknown>) {
  return <div>{children}</div>;
}
