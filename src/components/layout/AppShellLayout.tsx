'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import DocsSidebar from '@/components/layout/DocsSidebar';
import Header from '@/components/layout/Header';
import { UploadProvider } from '@/lib/upload-context';
import GlobalUploadQueue from '@/components/upload/GlobalUploadQueue';
import GlobalQuickActionsFab from '@/components/layout/GlobalQuickActionsFab';
import GlobalQuickActionModalHost from '@/components/layout/GlobalQuickActionModalHost';
import { createClient } from '@/lib/supabase/client';
import { subscribeToTasks, subscribeToTableChanges } from '@/lib/realtime';
import { CommandPaletteProvider, useCommandPalette } from '@/lib/command-palette-context';
import { AiProvider, useAi } from '@/lib/ai-context';
import { queryClient } from '@/app/providers';
import { QuickActionsProvider } from '@/lib/quick-actions-context';

const AiCommandCenter = dynamic(
  () => import('@/components/ai/AiCommandCenter'),
  { ssr: false },
);
const NotificationRealtimeSync = dynamic(
  () => import('@/components/notifications/NotificationRealtimeSync'),
  { ssr: false },
);
const CommandPalette = dynamic(
  () => import('@/components/search/CommandPalette'),
  { ssr: false },
);

const SESSION_CHECK_INTERVAL = 3 * 60 * 1000;
const ACTIVITY_PING_INTERVAL = 5 * 60 * 1000;

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isOpen: paletteOpen, close: closePalette } = useCommandPalette();
  const { open: openAi } = useAi();

  useEffect(() => {
    const supabaseClient = createClient();

    async function checkRevocation() {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5_000);
      try {
        const res = await fetch('/api/auth/sessions/check', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.status === 401) {
          await supabaseClient.auth.signOut();
          router.replace('/');
        }
      } catch { /* ignore network errors / abort */ } finally {
        clearTimeout(tid);
      }
    }

    async function pingActivity() {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5_000);
      try {
        await fetch('/api/auth/sessions/activity', {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
        });
      } catch { /* ignore */ } finally {
        clearTimeout(tid);
      }
    }

    checkRevocation();
    pingActivity();

    checkTimer.current = setInterval(checkRevocation, SESSION_CHECK_INTERVAL);
    activityTimer.current = setInterval(pingActivity, ACTIVITY_PING_INTERVAL);

    const unsubTasks = subscribeToTasks(() => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks-my'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks-select'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['at-risk-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
      void queryClient.invalidateQueries({ queryKey: ['calendar'] });
      void queryClient.invalidateQueries({ queryKey: ['reports-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-trends'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-team-performance'] });
    });

    const unsubscribeTableListeners = [
      subscribeToTableChanges({ table: 'clients' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
        void queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
        void queryClient.invalidateQueries({ queryKey: ['clients'] });
        void queryClient.invalidateQueries({ queryKey: ['dashboard-active-clients'] });
      }),
      subscribeToTableChanges({ table: 'projects' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['projects'] });
      }),
      subscribeToTableChanges({ table: 'content_items' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['content-items'] });
      }),
      subscribeToTableChanges({ table: 'assets' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard-recent-assets'] });
        void queryClient.invalidateQueries({ queryKey: ['asset-content-types'] });
      }),
      subscribeToTableChanges({ table: 'publishing_schedules' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
      }),
    ];

    function handleAiShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        openAi();
      }
    }
    window.addEventListener('keydown', handleAiShortcut);

    return () => {
      if (checkTimer.current) clearInterval(checkTimer.current);
      if (activityTimer.current) clearInterval(activityTimer.current);
      unsubTasks();
      unsubscribeTableListeners.forEach(unsub => unsub());
      window.removeEventListener('keydown', handleAiShortcut);
    };
  }, [openAi, router]);

  const isDocsWorkspace = pathname.startsWith('/docs');

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {isDocsWorkspace ? (
        <DocsSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : (
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto app-shell-main">{children}</main>
      </div>

      <GlobalQuickActionsFab />
      <GlobalQuickActionModalHost />
      <GlobalUploadQueue />
      <AiCommandCenter />
      <NotificationRealtimeSync />
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      <QuickActionsProvider>
        <CommandPaletteProvider>
          <AiProvider>
            <AppShell>{children}</AppShell>
          </AiProvider>
        </CommandPaletteProvider>
      </QuickActionsProvider>
    </UploadProvider>
  );
}
