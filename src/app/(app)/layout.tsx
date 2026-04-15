'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { UploadProvider } from '@/lib/upload-context';
import GlobalUploadQueue from '@/components/upload/GlobalUploadQueue';
import { createClient } from '@/lib/supabase/client';
import { subscribeToTasks } from '@/lib/realtime';
import { CommandPaletteProvider, useCommandPalette } from '@/lib/command-palette-context';
import { AiProvider, useAi } from '@/lib/ai-context';
import { queryClient } from '@/app/providers';

// Lazy-load non-critical panels after the page shell has rendered.
// ssr: false ensures these are client-only (they use browser APIs) and avoids
// adding them to the initial JS bundle parse cost.
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

// How often to check if the session has been revoked (ms)
const SESSION_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
// How often to update last_seen_at (ms)
const ACTIVITY_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ── Inner layout — needs access to CommandPaletteContext ──────────────────────

function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimer    = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isOpen: paletteOpen, close: closePalette } = useCommandPalette();
  const { open: openAi } = useAi();

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

    // ── 4. Cmd/Ctrl+J opens the AI Command Center ────────────────────────────
    function handleAiShortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        openAi();
      }
    }
    window.addEventListener('keydown', handleAiShortcut);

    return () => {
      if (checkTimer.current)    clearInterval(checkTimer.current);
      if (activityTimer.current) clearInterval(activityTimer.current);
      unsubTasks();
      window.removeEventListener('keydown', handleAiShortcut);
    };
  }, [openAi]);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>

      {/* Global upload queue panel — visible across all routes */}
      <GlobalUploadQueue />
      <AiCommandCenter />
      {/* Real-time notification sync: subscribes to Supabase Realtime and fires toasts */}
      <NotificationRealtimeSync />
      {/* Universal command palette — CMD+K */}
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <UploadProvider>
      <CommandPaletteProvider>
        <AiProvider>
          <AppShell>{children}</AppShell>
        </AiProvider>
      </CommandPaletteProvider>
    </UploadProvider>
  );
}

