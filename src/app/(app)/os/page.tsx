'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const FALLBACK_PAGE = '/os/dashboard';

export default function OsRootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('openy_last_opened_page');
      if (saved && saved !== '/' && saved !== '/os') {
        router.replace(saved);
        return;
      }
    } catch {
      // ignore storage errors
    }
    router.replace(FALLBACK_PAGE);
  }, [router]);

  return (
    <div className="flex items-center justify-center h-48">
      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
    </div>
  );
}
