'use client';

/**
 * NotificationRealtimeSync
 *
 * Rendered inside ToastProvider. Subscribes to new notifications via Supabase
 * Realtime, fires a toast for each one, and invalidates the React Query
 * notifications cache so the bell and dropdown refresh instantly.
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { useAuth } from '@/context/auth-context';
import { subscribeToNotifications, type NotificationPayload } from '@/lib/realtime';

export default function NotificationRealtimeSync() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const { user }    = useAuth();

  // Keep a stable, always-current ref to the user id so the subscription
  // callback can access it without being re-created on every user change.
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  useEffect(() => {
    const unsub = subscribeToNotifications((payload: NotificationPayload) => {
      // Only show toast if the notification targets this user (or is broadcast)
      const mine = !payload.user_id || payload.user_id === userIdRef.current;
      if (!mine) return;

      // Map notification type to toast type
      const typeMap: Record<string, 'success' | 'error' | 'warning' | 'info'> = {
        success: 'success',
        error:   'error',
        warning: 'warning',
        info:    'info',
      };
      const toastType = typeMap[payload.type] ?? 'info';

      toast(payload.title ? `${payload.title}: ${payload.message}` : payload.message, toastType, 5000);

      // Invalidate notification query caches so bell + dropdown refresh
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return unsub;
  }, [queryClient, toast]); // userIdRef is stable — no need to include

  return null;
}
