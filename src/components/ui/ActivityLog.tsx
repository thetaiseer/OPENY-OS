'use client';

import type { ReactNode } from 'react';

export default function ActivityLog({ children }: { children?: ReactNode; [key: string]: any }) {
  return <div>{children}</div>;
}
