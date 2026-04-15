/**
 * src/lib/workspace-events.ts
 *
 * Workspace command/event backbone.
 * All actions (task create/update, asset upload, AI mutation, etc.) should emit
 * a workspace event via emitEvent().  Events feed:
 *  - Activity log (activities table)
 *  - Automations (trigger matching against automation_rules)
 *  - Real-time notifications (via Supabase Realtime)
 *  - Analytics / dashboard updates (query cache invalidation signals)
 *
 * Usage (server-side Route Handlers):
 *   import { emitEvent } from '@/lib/workspace-events';
 *   await emitEvent(db, { event_type: 'task.created', entity_type: 'task',
 *     entity_id: task.id, actor_id: profile.id, payload: { task } });
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface WorkspaceEventPayload {
  workspace_id?: string | null;
  event_type: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  payload?: Record<string, unknown>;
}

/**
 * Emit a workspace event.  Fire-and-forget; errors are logged but never thrown
 * so they never block the primary response path.
 */
export async function emitEvent(
  db: SupabaseClient,
  event: WorkspaceEventPayload,
): Promise<void> {
  try {
    const { error } = await db.from('workspace_events').insert({
      workspace_id: event.workspace_id ?? null,
      event_type:   event.event_type,
      entity_type:  event.entity_type ?? null,
      entity_id:    event.entity_id   ?? null,
      actor_id:     event.actor_id    ?? null,
      payload:      event.payload     ?? {},
    });
    if (error) {
      console.warn('[workspace-events] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[workspace-events] unexpected error:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Canonical event type constants — use these instead of raw strings to avoid
 * typos and to ensure automations can rely on stable identifiers.
 */
export const EVENT = {
  // Tasks
  TASK_CREATED:   'task.created',
  TASK_UPDATED:   'task.updated',
  TASK_DELETED:   'task.deleted',
  TASK_STATUS:    'task.status_changed',
  TASK_ASSIGNED:  'task.assigned',
  // Assets
  ASSET_UPLOADED: 'asset.uploaded',
  ASSET_DELETED:  'asset.deleted',
  // Content
  CONTENT_CREATED:     'content.created',
  CONTENT_STATUS:      'content.status_changed',
  CONTENT_PUBLISHED:   'content.published',
  // Clients
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  // Projects
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_STATUS:  'project.status_changed',
  // Notes
  NOTE_CREATED: 'note.created',
  NOTE_UPDATED: 'note.updated',
  // AI
  AI_ACTION:    'ai.action',
  // Automations
  AUTOMATION_RUN: 'automation.run',
} as const;

export type EventType = typeof EVENT[keyof typeof EVENT];
