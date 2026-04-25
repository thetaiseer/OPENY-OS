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
export async function emitEvent(db: SupabaseClient, event: WorkspaceEventPayload): Promise<void> {
  try {
    const { error } = await db.from('activity_log').insert({
      workspace_id: event.workspace_id ?? null,
      event_type: event.event_type,
      entity_type: event.entity_type ?? null,
      entity_id: event.entity_id ?? null,
      actor_id: event.actor_id ?? null,
      payload: event.payload ?? {},
    });
    if (error) {
      console.warn('[workspace-events] insert failed:', error.message);
    }
  } catch (err) {
    console.warn(
      '[workspace-events] unexpected error:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Canonical event type constants — use these instead of raw strings to avoid
 * typos and to ensure automations can rely on stable identifiers.
 */
export const EVENT = {
  // ── Tasks ────────────────────────────────────────────────────────────────
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_DELETED: 'task.deleted',
  TASK_STATUS: 'task.status_changed',
  TASK_ASSIGNED: 'task.assigned',
  TASK_COMPLETED: 'task.completed',
  TASK_OVERDUE: 'task.overdue',
  TASK_COMMENT_ADDED: 'task.comment_added',
  TASK_PRIORITY_CHANGED: 'task.priority_changed',
  TASK_DEADLINE_APPROACHING: 'task.deadline_approaching',
  TASK_REOPENED: 'task.reopened',
  TASK_DUE_SOON: 'task.due_soon',
  TASK_STALE: 'task.stale',

  // ── Clients ──────────────────────────────────────────────────────────────
  CLIENT_CREATED: 'client.created',
  CLIENT_UPDATED: 'client.updated',
  CLIENT_ARCHIVED: 'client.archived',
  CLIENT_OWNER_CHANGED: 'client.owner_changed',

  // ── Content ──────────────────────────────────────────────────────────────
  CONTENT_CREATED: 'content.created',
  CONTENT_UPDATED: 'content.updated',
  CONTENT_APPROVED: 'content.approved',
  CONTENT_REJECTED: 'content.rejected',
  CONTENT_SCHEDULED: 'content.scheduled',
  CONTENT_PUBLISHED: 'content.published',
  CONTENT_PUBLISH_FAILED: 'content.publish_failed',
  CONTENT_DEADLINE_APPROACHING: 'content.deadline_approaching',
  CONTENT_STATUS: 'content.status_changed',

  // ── Assets ───────────────────────────────────────────────────────────────
  ASSET_UPLOAD_STARTED: 'asset.upload_started',
  ASSET_UPLOAD_COMPLETED: 'asset.upload_completed',
  ASSET_UPLOAD_FAILED: 'asset.upload_failed',
  ASSET_DELETED: 'asset.deleted',
  ASSET_DOWNLOADED: 'asset.downloaded',
  ASSET_FOLDER_CREATED: 'asset.folder_created',
  ASSET_UPLOADED: 'asset.uploaded', // alias for upload_completed

  // ── Calendar / Schedule ──────────────────────────────────────────────────
  EVENT_CREATED: 'event.created',
  EVENT_UPDATED: 'event.updated',
  EVENT_REMINDER_DUE: 'event.reminder_due',
  PUBLISH_WINDOW_APPROACHING: 'publish_window.approaching',
  POSTING_TIME_REACHED: 'posting_time.reached',

  // ── Team ─────────────────────────────────────────────────────────────────
  INVITE_SENT: 'invite.sent',
  INVITE_ACCEPTED: 'invite.accepted',
  INVITE_EXPIRED: 'invite.expired',
  INVITE_CANCELLED: 'invite.cancelled',
  MEMBER_JOINED: 'member.joined',
  MEMBER_REMOVED: 'member.removed',
  ROLE_CHANGED: 'role.changed',
  PERMISSION_CHANGED: 'permission.changed',

  // ── Security / System ────────────────────────────────────────────────────
  LOGIN_NEW_DEVICE: 'login.new_device',
  LOGIN_FAILED: 'login.failed',
  PERMISSION_DENIED: 'permission.denied',
  CRITICAL_SYSTEM_ERROR: 'critical.system_error',
  STORAGE_UPLOAD_ERROR: 'storage.upload_error',
  API_FAILURE: 'api.failure',
  INTEGRATION_DISCONNECTED: 'integration.disconnected',

  // ── Projects / Notes ─────────────────────────────────────────────────────
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_STATUS: 'project.status_changed',
  NOTE_CREATED: 'note.created',
  NOTE_UPDATED: 'note.updated',

  // ── AI ───────────────────────────────────────────────────────────────────
  AI_ACTION: 'ai.action',

  // ── Automations ──────────────────────────────────────────────────────────
  AUTOMATION_RUN: 'automation.run',

  // ── Comments ─────────────────────────────────────────────────────────────
  COMMENT_ADDED: 'comment.added',
} as const;

export type EventType = (typeof EVENT)[keyof typeof EVENT];
