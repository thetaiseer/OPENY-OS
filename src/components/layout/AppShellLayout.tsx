'use client';

import type { ReactNode } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

export default function AppShellLayout({ children }: { children?: ReactNode }) {
  return (
    <div className="min-h-screen bg-base text-primary">
      <Sidebar />
      <Header />
      <main className="pb-20 pt-16 md:ml-64 md:pb-6">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
