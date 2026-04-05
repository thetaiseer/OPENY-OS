'use client';

import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import { UploadProvider } from '@/lib/upload-context';
import GlobalUploadQueue from '@/components/upload/GlobalUploadQueue';
import { createClient } from '@/lib/supabase/client';

// How often to check if the session has been revoked (ms)
const SESSION_CHECK_INTERVAL = 3 * 60 * 1000; // 3 minutes
// How often to update last_seen_at (ms)
const ACTIVITY_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();
  const activityTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkTimer    = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // ── 1. Check if the current session has been revoked ─────────────────────
    async function checkRevocation() {
      try {
        const res = await fetch('/api/auth/sessions/check', { credentials: 'include' });
        if (res.status === 401) {
          // Session revoked — sign out and redirect
          await supabase.auth.signOut();
          window.location.replace('/login');
        }
      } catch { /* ignore network errors */ }
    }

    // ── 2. Ping last_seen_at so the session stays "active" ───────────────────
    async function pingActivity() {
      try {
        await fetch('/api/auth/sessions/activity', { method: 'POST', credentials: 'include' });
      } catch { /* ignore */ }
    }

    // Run checks immediately on mount, then on intervals
    checkRevocation();
    pingActivity();

    checkTimer.current    = setInterval(checkRevocation, SESSION_CHECK_INTERVAL);
    activityTimer.current = setInterval(pingActivity,    ACTIVITY_PING_INTERVAL);

    return () => {
      if (checkTimer.current)    clearInterval(checkTimer.current);
      if (activityTimer.current) clearInterval(activityTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
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
    </UploadProvider>
  );
}

