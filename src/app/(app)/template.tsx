'use client';

import type { ReactNode } from 'react';

export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="openy-page-transition">{children}</div>;
}
