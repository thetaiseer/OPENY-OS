/**
 * Supabase Realtime subscription helpers.
 * Call subscribeToTasks / subscribeToNotifications from the app layout
 * and integrate with React Query to invalidate caches on changes.
 *
 * Prerequisites:
 *   - Enable Realtime for the `tasks` and `notifications` tables in your
 *     Supabase project (Database → Replication → Tables).
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to INSERT/UPDATE/DELETE events on the `tasks` table.
 * Returns an unsubscribe function.
 */
export function subscribeToTasks(onChange: () => void): () => void {
  const supabase = createClient();

  const channel: RealtimeChannel = supabase
    .channel('realtime:tasks')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (_payload) => { onChange(); },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}

/**
 * Subscribe to INSERT events on the `notifications` table.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(onChange: () => void): () => void {
  const supabase = createClient();

  const channel: RealtimeChannel = supabase
    .channel('realtime:notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (_payload) => { onChange(); },
    )
    .subscribe();

  return () => { void supabase.removeChannel(channel); };
}
