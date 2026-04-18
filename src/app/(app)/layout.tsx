'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import AppTopbar from '@/components/layout/AppTopbar';
import AppShellLayout from '@/components/layout/AppShell';
import { AppPage } from '@/components/layout/AppPage';
import { UploadProvider } from '@/lib/upload-context';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <UploadProvider>
      <AppShellLayout
        workspaceClassName="os-workspace"
        sidebar={<Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        topbar={<AppTopbar onMenuClick={() => setSidebarOpen(true)} />}
      >
        <AppPage>{children}</AppPage>
      </AppShellLayout>
    </UploadProvider>
  );
}
