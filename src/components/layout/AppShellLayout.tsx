'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { UploadProvider } from '@/context/upload-context';
import GlobalUploadQueue from '@/components/upload/GlobalUploadQueue';
import GlobalQuickActionsFab from '@/components/layout/GlobalQuickActionsFab';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import GlobalQuickActionModalHost from '@/components/layout/GlobalQuickActionModalHost';
import { createClient } from '@/lib/supabase/client';
import { subscribeToTasks, subscribeToTableChanges } from '@/lib/realtime';
import { CommandPaletteProvider, useCommandPalette } from '@/context/command-palette-context';
import { AiProvider, useAi } from '@/context/ai-context';
import { queryClient } from '@/app/providers';
import { QuickActionsProvider } from '@/context/quick-actions-context';
import AppRouteTransition from '@/components/layout/AppRouteTransition';

const AiCommandCenter = dynamic(() => import('@/components/ai/AiCommandCenter'), { ssr: false });
const NotificationRealtimeSync = dynamic(
  () => import('@/components/notifications/NotificationRealtimeSync'),
  { ssr: false },
);
const CommandPalette = dynamic(() => import('@/components/search/CommandPalette'), { ssr: false });

const SESSION_CHECK_INTERVAL = 3 * 60 * 1000;
const ACTIVITY_PING_INTERVAL = 5 * 60 * 1000;

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const isDocs = pathname.startsWith('/docs');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isOpen: paletteOpen, close: closePalette } = useCommandPalette();
  const { open: openAi } = useAi();

  useEffect(() => {
    document.documentElement.classList.remove('workspace-switching');
  }, [pathname]);

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
      } catch {
        /* ignore network errors / abort */
      } finally {
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
      } catch {
        /* ignore */
      } finally {
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
      unsubscribeTableListeners.forEach((unsub) => unsub());
      window.removeEventListener('keydown', handleAiShortcut);
    };
  }, [openAi, router]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'transparent' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main
          className={clsx(
            'app-shell-main flex-1 overflow-y-auto',
            !isDocs &&
              'max-lg:pb-[calc(var(--shell-pad-y)+4.25rem+env(safe-area-inset-bottom,0px))]',
          )}
          style={{ background: 'var(--gradient-main-overlay)' }}
        >
          <AppRouteTransition>{children}</AppRouteTransition>
        </main>
      </div>

      <MobileBottomNav />
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
