'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { UploadProvider } from '@/lib/upload-context';
import GlobalUploadQueue from '@/components/upload/GlobalUploadQueue';
import { ToastProvider } from '@/lib/toast-context';
import ToastContainer from '@/components/ui/ToastContainer';
import { createClient } from '@/lib/supabase/client';
import AiAssistantPanel from '@/components/ai/AiAssistantPanel';
import { subscribeToTasks, subscribeToNotifications } from '@/lib/realtime';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

// How often to check if the session has been revoked (ms)
const SESSION_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
// How often to update last_seen_at (ms)
const ACTIVITY_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const supabaseClient = createClient();

    // ── 1. Check if the current session has been revoked ─────────────────────
    async function checkRevocation() {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5_000);
      try {
        const res = await fetch('/api/auth/sessions/check', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (res.status === 401) {
          // Session revoked — sign out and redirect
          await supabaseClient.auth.signOut();
          window.location.replace('/login');
        }
      } catch { /* ignore network errors / abort */ } finally {
        clearTimeout(tid);
      }
    }

    // ── 2. Ping last_seen_at so the session stays "active" ───────────────────
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

    // Run checks immediately on mount, then on intervals
    checkRevocation();
    pingActivity();

    checkTimer.current    = setInterval(checkRevocation, SESSION_CHECK_INTERVAL);
    activityTimer.current = setInterval(pingActivity,    ACTIVITY_PING_INTERVAL);

    // ── 3. Realtime subscriptions — invalidate React Query caches on change ──
    const unsubTasks = subscribeToTasks(() => {
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      void queryClient.invalidateQueries({ queryKey: ['at-risk-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['activities'] });
    });
    const unsubNotifs = subscribeToNotifications(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    return () => {
      if (checkTimer.current)    clearInterval(checkTimer.current);
      if (activityTimer.current) clearInterval(activityTimer.current);
      unsubTasks();
      unsubNotifs();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <UploadProvider>
          <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header onMenuClick={() => setSidebarOpen(true)} />
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
          </div>
          {/* Global upload queue panel — visible across all routes */}
          <GlobalUploadQueue />
          <ToastContainer />
          <AiAssistantPanel />
        </UploadProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

