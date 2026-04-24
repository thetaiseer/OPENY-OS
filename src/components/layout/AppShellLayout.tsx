'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { UploadProvider } from '@/context/upload-context';
import GlobalUploadQueue from '@/components/features/upload/GlobalUploadQueue';
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

const AiCommandCenter = dynamic(() => import('@/components/features/ai/AiCommandCenter'), {
  ssr: false,
});
const NotificationRealtimeSync = dynamic(
  () => import('@/components/features/notifications/NotificationRealtimeSync'),
  { ssr: false },
);
const CommandPalette = dynamic(() => import('@/components/features/search/CommandPalette'), {
  ssr: false,
});

const SESSION_CHECK_INTERVAL = 3 * 60 * 1000;
const ACTIVITY_PING_INTERVAL = 5 * 60 * 1000;

function AppMainSkeleton() {
  return (
    <div className="animate-pulse space-y-6 p-4 md:p-6">
      <div className="h-9 w-48 rounded-xl" style={{ background: 'var(--surface)' }} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-28 rounded-2xl" style={{ background: 'var(--surface)' }} />
        ))}
      </div>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const isDocs = pathname.startsWith('/docs');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const { isOpen: paletteOpen, close: closePalette } = useCommandPalette();
  const { open: openAi } = useAi();

  useEffect(() => {
    document.documentElement.classList.remove('workspace-switching');
  }, [pathname]);

  useEffect(() => {
    const supabaseClient = createClient();
    const debounceMs = 400;
    function createDebouncer() {
      let timer: ReturnType<typeof setTimeout> | null = null;
      return (fn: () => void) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          fn();
        }, debounceMs);
      };
    }
    const debounceTasks = createDebouncer();
    const debounceClients = createDebouncer();
    const debounceContent = createDebouncer();
    const debounceAssets = createDebouncer();
    const debouncePublishing = createDebouncer();

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
      debounceTasks(() => {
        const p = pathnameRef.current;
        void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
        void queryClient.invalidateQueries({ queryKey: ['tasks-my'] });
        void queryClient.invalidateQueries({ queryKey: ['tasks-select'] });
        if (p.includes('/activity') || p.includes('/clients/')) {
          void queryClient.invalidateQueries({ queryKey: ['activities'] });
        }
        if (p.includes('/calendar') || p.startsWith('/os/calendar')) {
          void queryClient.invalidateQueries({ queryKey: ['calendar'] });
        }
        if (p.includes('/dashboard') || p.startsWith('/os/dashboard')) {
          void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
          void queryClient.invalidateQueries({ queryKey: ['at-risk-tasks'] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard-trends'] });
          void queryClient.invalidateQueries({ queryKey: ['dashboard-team-performance'] });
        }
        if (p.includes('/reports') || p.startsWith('/os/reports')) {
          void queryClient.invalidateQueries({ queryKey: ['reports-overview'] });
        }
      });
    });

    const unsubscribeTableListeners = [
      subscribeToTableChanges({ table: 'clients' }, () => {
        debounceClients(() => {
          const p = pathnameRef.current;
          void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
          void queryClient.invalidateQueries({ queryKey: ['clients-stats'] });
          void queryClient.invalidateQueries({ queryKey: ['clients'] });
          void queryClient.invalidateQueries({ queryKey: ['quick-actions-clients'] });
          if (p.includes('/dashboard') || p.startsWith('/os/dashboard')) {
            void queryClient.invalidateQueries({ queryKey: ['dashboard-active-clients'] });
          }
        });
      }),
      subscribeToTableChanges({ table: 'projects' }, () => {
        debounceClients(() => {
          void queryClient.invalidateQueries({ queryKey: ['projects'] });
        });
      }),
      subscribeToTableChanges({ table: 'content_items' }, () => {
        debounceContent(() => {
          void queryClient.invalidateQueries({ queryKey: ['content-items'] });
        });
      }),
      subscribeToTableChanges({ table: 'assets' }, () => {
        debounceAssets(() => {
          const p = pathnameRef.current;
          void queryClient.invalidateQueries({ queryKey: ['asset-content-types'] });
          void queryClient.invalidateQueries({ queryKey: ['assets'] });
          if (p.includes('/dashboard') || p.startsWith('/os/dashboard')) {
            void queryClient.invalidateQueries({ queryKey: ['dashboard-recent-assets'] });
          }
        });
      }),
      subscribeToTableChanges({ table: 'publishing_schedules' }, () => {
        debouncePublishing(() => {
          void queryClient.invalidateQueries({ queryKey: ['scheduled-posts'] });
        });
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
  }, [openAi, router, pathname]);

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
          <Suspense fallback={<AppMainSkeleton />}>
            <AppRouteTransition>{children}</AppRouteTransition>
          </Suspense>
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
