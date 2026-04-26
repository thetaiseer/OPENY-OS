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
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (_payload) => {
      onChange();
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export interface TableSubscriptionConfig {
  table: string;
  schema?: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  channelName?: string;
}

export function subscribeToTableChanges(
  config: TableSubscriptionConfig,
  onChange: () => void,
): () => void {
  const supabase = createClient();
  const schema = config.schema ?? 'public';
  const event = config.event ?? '*';
  const channelName = config.channelName ?? `realtime:${schema}:${config.table}:${event}`;

  const channel: RealtimeChannel = supabase
    .channel(channelName)
    .on('postgres_changes', { event, schema, table: config.table }, (_payload) => {
      onChange();
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  type: string;
  module?: string | null;
  user_id: string | null;
  event_type: string | null;
  action_url: string | null;
  created_at: string;
}

/**
 * Subscribe to INSERT events on the `notifications` table.
 * `onNew` is called with the inserted row payload on each new notification.
 * Returns an unsubscribe function.
 */
export function subscribeToNotifications(
  onNew: (payload: NotificationPayload) => void,
): () => void {
  const supabase = createClient();

  const channel: RealtimeChannel = supabase
    .channel('realtime:notifications')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (event) => {
        onNew(event.new as NotificationPayload);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
