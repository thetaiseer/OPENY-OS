/**
 * src/lib/event-engine.ts
 *
 * CENTRAL EVENT + NOTIFICATION + HISTORY ENGINE
 *
 * processEvent() is the single entry point for every important system action.
 * It fans out to:
 *   1. Activity log (permanent history, never deleted)
 *   2. In-app notifications (with priority, category, dedup)
 *   3. Email notifications (per preferences, urgency-based)
 *   4. Scheduled reminders (deadline/publish-window jobs)
 *
 * Usage in API routes:
 *   import { processEvent } from '@/lib/event-engine';
 *   await processEvent({
 *     event_type: 'task.assigned',
 *     actor_id:   profile.id,
 *     entity_type: 'task',
 *     entity_id:  task.id,
 *     payload:    { taskTitle: title, assigneeName, clientName },
 *     recipients: [assigneeId],
 *   });
 *
 * Never throws — all fanout errors are caught and logged individually.
 */

import { getServiceClient } from '@/lib/supabase/service-client';
import { sendEmail, logEmailSent } from '@/lib/email';
import type { NotificationCategory, NotificationPriority } from '@/lib/types';

// ── Event input shape ─────────────────────────────────────────────────────────

export interface EngineEventInput {
  /** Canonical event type (e.g. 'task.assigned') */
  event_type: string;
  /** Profile UUID of the person who triggered the action */
  actor_id?: string | null;
  /** Object type affected (task, asset, content_item, etc.) */
  entity_type?: string | null;
  /** UUID of the affected object */
  entity_id?: string | null;
  /** Workspace scope */
  workspace_id?: string | null;
  /** Client scope (optional) */
  client_id?: string | null;
  /** Specific recipient user IDs.  null means "broadcast to admins". */
  recipients?: Array<string | null | undefined>;
  /** Additional structured data for rendering notifications and timeline */
  payload?: Record<string, unknown>;
  /** Optional override: when set, skips event rules and uses these values */
  override?: {
    title?: string;
    message?: string;
    priority?: NotificationPriority;
    category?: NotificationCategory;
    action_url?: string;
    send_email?: boolean;
    email_subject?: string;
    email_html?: string;
  };
}

// ── Event routing rules ───────────────────────────────────────────────────────
// Controls priority, category, channel behaviour per event type.

interface EventRule {
  priority: NotificationPriority;
  category: NotificationCategory;
  title: (p: Record<string, unknown>) => string;
  message: (p: Record<string, unknown>) => string;
  action_url: (p: Record<string, unknown>) => string;
  /** Should an email be attempted? */
  send_email: boolean;
  /** Provide subject only when send_email=true */
  email_subject?: (p: Record<string, unknown>) => string;
}

const EVENT_RULES: Record<string, EventRule> = {
  // ── Tasks ────────────────────────────────────────────────────────────────
  'task.created': {
    priority: 'low',
    category: 'tasks',
    title: () => 'Task Created',
    message: (p) =>
      `Task "${p.taskTitle ?? 'Untitled'}" was created${p.clientName ? ` for ${p.clientName}` : ''}`,
    action_url: () => '/os/tasks',
    send_email: false,
  },
  'task.assigned': {
    priority: 'medium',
    category: 'tasks',
    title: () => 'Task Assigned',
    message: (p) =>
      `You were assigned: "${p.taskTitle ?? 'a task'}"${p.clientName ? ` — ${p.clientName}` : ''}`,
    action_url: () => '/os/tasks',
    send_email: true,
    email_subject: (p) => `New task assigned: ${p.taskTitle ?? 'a task'}`,
  },
  'task.status_changed': {
    priority: 'low',
    category: 'tasks',
    title: () => 'Task Updated',
    message: (p) => `"${p.taskTitle ?? 'Task'}" status changed to ${p.newStatus ?? 'updated'}`,
    action_url: () => '/os/tasks',
    send_email: false,
  },
  'task.completed': {
    priority: 'low',
    category: 'tasks',
    title: () => 'Task Completed',
    message: (p) => `"${p.taskTitle ?? 'A task'}" was marked completed`,
    action_url: () => '/os/tasks',
    send_email: false,
  },
  'task.overdue': {
    priority: 'high',
    category: 'tasks',
    title: () => '🚨 Task Overdue',
    message: (p) =>
      `"${p.taskTitle ?? 'A task'}" is overdue${p.daysOverdue ? ` by ${p.daysOverdue} day(s)` : ''}`,
    action_url: () => '/os/tasks',
    send_email: true,
    email_subject: (p) => `Task overdue: ${p.taskTitle ?? 'a task'}`,
  },
  'task.due_soon': {
    priority: 'medium',
    category: 'tasks',
    title: () => '⏰ Deadline Approaching',
    message: (p) => `"${p.taskTitle ?? 'A task'}" is due in ${p.daysLeft ?? '< 1'} day(s)`,
    action_url: () => '/os/tasks',
    send_email: true,
    email_subject: (p) => `Task due soon: ${p.taskTitle ?? 'a task'}`,
  },
  'task.comment_added': {
    priority: 'medium',
    category: 'tasks',
    title: () => 'New Comment',
    message: (p) => `${p.actorName ?? 'Someone'} commented on "${p.taskTitle ?? 'a task'}"`,
    action_url: (p) => (p.taskId ? `/os/tasks` : '/os/tasks'),
    send_email: false,
  },
  'task.stale': {
    priority: 'medium',
    category: 'tasks',
    title: () => 'Task Has No Recent Updates',
    message: (p) =>
      `"${p.taskTitle ?? 'A task'}" has not been updated in ${p.staleDays ?? 'several'} days`,
    action_url: () => '/os/tasks',
    send_email: false,
  },
  'task.reopened': {
    priority: 'medium',
    category: 'tasks',
    title: () => 'Task Reopened',
    message: (p) => `"${p.taskTitle ?? 'A task'}" was reopened`,
    action_url: () => '/os/tasks',
    send_email: false,
  },
  'task.priority_changed': {
    priority: 'low',
    category: 'tasks',
    title: () => 'Task Priority Changed',
    message: (p) =>
      `"${p.taskTitle ?? 'A task'}" priority changed to ${p.newPriority ?? 'updated'}`,
    action_url: () => '/os/tasks',
    send_email: false,
  },

  // ── Clients ──────────────────────────────────────────────────────────────
  'client.created': {
    priority: 'low',
    category: 'system',
    title: () => 'New Client Added',
    message: (p) => `"${p.clientName ?? 'A client'}" was added to the workspace`,
    action_url: () => '/os/clients',
    send_email: false,
  },
  'client.updated': {
    priority: 'low',
    category: 'system',
    title: () => 'Client Updated',
    message: (p) => `"${p.clientName ?? 'A client'}" profile was updated`,
    action_url: () => '/os/clients',
    send_email: false,
  },
  'client.archived': {
    priority: 'medium',
    category: 'system',
    title: () => 'Client Archived',
    message: (p) => `"${p.clientName ?? 'A client'}" has been archived`,
    action_url: () => '/os/clients',
    send_email: false,
  },

  // ── Content ──────────────────────────────────────────────────────────────
  'content.created': {
    priority: 'low',
    category: 'content',
    title: () => 'Content Created',
    message: (p) =>
      `"${p.contentTitle ?? 'New content'}" was created${p.clientName ? ` for ${p.clientName}` : ''}`,
    action_url: () => '/os/content',
    send_email: false,
  },
  'content.approved': {
    priority: 'medium',
    category: 'content',
    title: () => 'Content Approved',
    message: (p) => `"${p.contentTitle ?? 'Content'}" was approved`,
    action_url: () => '/os/content',
    send_email: false,
  },
  'content.rejected': {
    priority: 'medium',
    category: 'content',
    title: () => 'Content Rejected',
    message: (p) =>
      `"${p.contentTitle ?? 'Content'}" was rejected${p.reason ? `: ${p.reason}` : ''}`,
    action_url: () => '/os/content',
    send_email: false,
  },
  'content.scheduled': {
    priority: 'medium',
    category: 'content',
    title: () => 'Content Scheduled',
    message: (p) =>
      `"${p.contentTitle ?? 'Content'}" scheduled for ${p.scheduledDate ?? 'upcoming date'}`,
    action_url: () => '/os/calendar',
    send_email: true,
    email_subject: (p) => `Content scheduled: ${p.contentTitle ?? 'upcoming post'}`,
  },
  'content.published': {
    priority: 'low',
    category: 'content',
    title: () => 'Content Published',
    message: (p) => `"${p.contentTitle ?? 'Content'}" was published successfully`,
    action_url: () => '/os/content',
    send_email: false,
  },
  'content.publish_failed': {
    priority: 'critical',
    category: 'content',
    title: () => '🚨 Publish Failed',
    message: (p) =>
      `"${p.contentTitle ?? 'Content'}" failed to publish at scheduled time${p.reason ? `: ${p.reason}` : ''}`,
    action_url: () => '/os/calendar',
    send_email: true,
    email_subject: (p) => `URGENT: Publish failed — ${p.contentTitle ?? 'content'}`,
  },
  'content.status_changed': {
    priority: 'low',
    category: 'content',
    title: () => 'Content Status Changed',
    message: (p) => `"${p.contentTitle ?? 'Content'}" moved to ${p.newStatus ?? 'updated'}`,
    action_url: () => '/os/content',
    send_email: false,
  },
  'publish_window.approaching': {
    priority: 'high',
    category: 'content',
    title: () => '📅 Publish Window Approaching',
    message: (p) => `Content is scheduled to publish in ${p.minutesBefore ?? '15'} minutes`,
    action_url: () => '/os/calendar',
    send_email: true,
    email_subject: (p) => `Publishing in ${p.minutesBefore ?? '15'} minutes — action required`,
  },

  // ── Assets ───────────────────────────────────────────────────────────────
  'asset.uploaded': {
    priority: 'medium',
    category: 'assets',
    title: () => 'Asset Uploaded',
    message: (p) =>
      `"${p.assetName ?? 'A file'}" was uploaded${p.clientName ? ` to ${p.clientName}` : ''}`,
    action_url: () => '/os/assets',
    send_email: false,
  },
  'asset.upload_failed': {
    priority: 'critical',
    category: 'assets',
    title: () => '🚨 Upload Failed',
    message: (p) =>
      `Upload failed for "${p.assetName ?? 'a file'}"${p.reason ? `: ${p.reason}` : ''}`,
    action_url: () => '/os/assets',
    send_email: true,
    email_subject: (p) => `Upload failed — ${p.assetName ?? 'file'}`,
  },
  'asset.deleted': {
    priority: 'low',
    category: 'assets',
    title: () => 'Asset Deleted',
    message: (p) => `"${p.assetName ?? 'A file'}" was deleted`,
    action_url: () => '/os/assets',
    send_email: false,
  },

  // ── Team ─────────────────────────────────────────────────────────────────
  'invite.sent': {
    priority: 'medium',
    category: 'team',
    title: () => 'Team Invitation Sent',
    message: (p) =>
      `Invitation sent to ${p.inviteeName ?? 'a new member'} as ${p.role ?? 'member'}`,
    action_url: () => '/os/team',
    send_email: false,
  },
  'invite.accepted': {
    priority: 'high',
    category: 'team',
    title: () => 'Invitation Accepted',
    message: (p) => `${p.inviteeName ?? 'A team member'} accepted their invitation`,
    action_url: () => '/os/team',
    send_email: false,
  },
  'member.joined': {
    priority: 'medium',
    category: 'team',
    title: () => 'New Team Member',
    message: (p) => `${p.memberName ?? 'A new member'} joined the workspace`,
    action_url: () => '/os/team',
    send_email: false,
  },
  'member.removed': {
    priority: 'medium',
    category: 'team',
    title: () => 'Team Member Removed',
    message: (p) => `${p.memberName ?? 'A member'} was removed from the workspace`,
    action_url: () => '/os/team',
    send_email: false,
  },
  'role.changed': {
    priority: 'medium',
    category: 'team',
    title: () => 'Role Changed',
    message: (p) => `${p.memberName ?? 'A member'} role changed to ${p.newRole ?? 'updated'}`,
    action_url: () => '/os/team',
    send_email: false,
  },
  'permission.changed': {
    priority: 'medium',
    category: 'team',
    title: () => 'Permissions Updated',
    message: (p) =>
      `${p.memberName ?? 'A member'} permissions were updated by ${p.actorName ?? 'an admin'}`,
    action_url: () => '/os/team',
    send_email: false,
  },
  'invite.cancelled': {
    priority: 'low',
    category: 'team',
    title: () => 'Invitation Cancelled',
    message: (p) => `Invitation for ${p.inviteeName ?? 'a member'} was cancelled`,
    action_url: () => '/os/team',
    send_email: false,
  },

  // ── Docs ─────────────────────────────────────────────────────────────────
  'invoice.generated': {
    priority: 'medium',
    category: 'content',
    title: () => 'Invoice Generated',
    message: (p) =>
      `Invoice "${p.invoiceNumber ?? 'draft'}" generated${p.clientName ? ` for ${p.clientName}` : ''}`,
    action_url: () => '/docs/invoice',
    send_email: false,
  },

  // ── Security / System ────────────────────────────────────────────────────
  'login.new_device': {
    priority: 'high',
    category: 'system',
    title: () => '🔒 New Device Login',
    message: (p) => `New login detected from ${p.device ?? 'unknown device'}`,
    action_url: () => '/os/security',
    send_email: true,
    email_subject: () => 'Security alert: new device login detected',
  },
  'login.failed': {
    priority: 'high',
    category: 'system',
    title: () => 'Login Attempt Failed',
    message: (p) => `Failed login attempt for ${p.email ?? 'your account'}`,
    action_url: () => '/os/security',
    send_email: false,
  },
  'critical.system_error': {
    priority: 'critical',
    category: 'system',
    title: () => '🚨 Critical System Error',
    message: (p) => `${p.errorDescription ?? 'A critical system error occurred'}`,
    action_url: () => '/os/settings',
    send_email: true,
    email_subject: () => 'CRITICAL: System error in OPENY OS',
  },
  'storage.upload_error': {
    priority: 'critical',
    category: 'system',
    title: () => '🚨 Storage Error',
    message: (p) => `Storage upload failed${p.details ? `: ${p.details}` : ''}`,
    action_url: () => '/os/assets',
    send_email: true,
    email_subject: () => 'URGENT: Storage upload error',
  },
  'api.failure': {
    priority: 'critical',
    category: 'system',
    title: () => '🚨 API Failure',
    message: (p) => `API failure detected${p.endpoint ? ` on ${p.endpoint}` : ''}`,
    action_url: () => '/os/settings',
    send_email: true,
    email_subject: () => 'CRITICAL: API failure detected',
  },
  'integration.disconnected': {
    priority: 'critical',
    category: 'system',
    title: () => '🔌 Integration Disconnected',
    message: (p) => `${p.integrationName ?? 'An integration'} has been disconnected`,
    action_url: () => '/os/settings',
    send_email: true,
    email_subject: (p) => `Integration disconnected: ${p.integrationName ?? 'service'}`,
  },

  // ── Comments ─────────────────────────────────────────────────────────────
  'comment.added': {
    priority: 'medium',
    category: 'tasks',
    title: () => 'New Comment',
    message: (p) =>
      `${p.actorName ?? 'Someone'} commented: "${String(p.preview ?? '').slice(0, 100)}"`,
    action_url: () => '/os/tasks',
    send_email: false,
  },
} satisfies Record<string, EventRule>;

// Default fallback rule
const DEFAULT_RULE: EventRule = {
  priority: 'low',
  category: 'system',
  title: (p) => (p.title as string) ?? 'Notification',
  message: (p) => (p.message as string) ?? 'Something happened',
  action_url: () => '/',
  send_email: false,
};

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Dedup window constants.
 * These control how long after a notification is created that an identical
 * event (same idempotency_key + user) is silently dropped.
 *
 * CRITICAL events use a longer window to prevent admin spam from rapid repeated
 * failures, while still allowing re-notification once the window expires.
 * Non-critical events reuse the same key but with a shorter window so users
 * are reminded if an issue persists past the window.
 */
const DEDUP_WINDOW_CRITICAL_HOURS = 4;
const DEDUP_WINDOW_DEFAULT_HOURS = 1;

/**
 * Build an idempotency key for a notification.
 * Format: `{event_type}:{entity_id}:{user_id}` — within 1-hour window
 * the exact same key will be blocked by the DB unique index.
 */
function buildIdempotencyKey(
  event_type: string,
  entity_id: string | null | undefined,
  user_id: string | null | undefined,
): string {
  const parts = [event_type, entity_id ?? 'null', user_id ?? 'broadcast'];
  return parts.join(':');
}

/**
 * Check whether a notification with this idempotency key already exists
 * within a dedup window (default 1 hour) to prevent flooding.
 */
async function isDuplicate(
  db: ReturnType<typeof getServiceClient>,
  idempotency_key: string,
  user_id: string | null,
  windowHours = 1,
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
    let query = db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('idempotency_key', idempotency_key)
      .gte('created_at', since);
    if (user_id) {
      query = query.eq('user_id', user_id);
    } else {
      query = query.is('user_id', null);
    }
    const { count } = await query;
    return (count ?? 0) > 0;
  } catch {
    return false; // fail open — allow notification if check errors
  }
}

// ── Activity log helper ───────────────────────────────────────────────────────

async function logActivity(
  db: ReturnType<typeof getServiceClient>,
  event: EngineEventInput,
  rule: EventRule,
): Promise<void> {
  const payload = event.payload ?? {};
  const moduleName = event.event_type.split('.')[0] || 'system';
  const rawStatus = String((payload.status as string | undefined) ?? 'success').toLowerCase();
  const status: 'success' | 'failed' | 'pending' =
    rawStatus === 'failed' || rawStatus === 'pending' ? rawStatus : 'success';
  try {
    await db.from('activities').insert({
      type: event.event_type,
      module: moduleName,
      status,
      category: rule.category,
      title: rule.title(payload),
      description: rule.message(payload),
      entity_type: event.entity_type ?? null,
      entity_id: event.entity_id ?? null,
      related_entity_type: event.entity_type ?? null,
      related_entity_id: event.entity_id ?? null,
      actor_id: event.actor_id ?? null,
      user_uuid: event.actor_id ?? null,
      client_id: event.client_id ?? null,
      workspace_id: event.workspace_id ?? null,
      user_role: (payload.userRole as string | undefined) ?? null,
      after_value: Object.keys(payload).length > 0 ? payload : null,
      metadata_json: Object.keys(payload).length > 0 ? payload : null,
    });
  } catch (err) {
    console.warn(
      '[event-engine] logActivity failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Notification helper ───────────────────────────────────────────────────────

async function createNotificationForUser(
  db: ReturnType<typeof getServiceClient>,
  user_id: string | null,
  event: EngineEventInput,
  rule: EventRule,
): Promise<string | null> {
  const payload = event.payload ?? {};
  const moduleName = event.event_type.split('.')[0] || 'system';
  const ikey = buildIdempotencyKey(event.event_type, event.entity_id, user_id);

  // Critical events use a longer dedup window (4 h) to ensure admins are not
  // spammed by rapidly repeated failures, but still notified when truly new.
  const dedupHours =
    rule.priority === 'critical' ? DEDUP_WINDOW_CRITICAL_HOURS : DEDUP_WINDOW_DEFAULT_HOURS;
  const dup = await isDuplicate(db, ikey, user_id, dedupHours);
  if (dup) return null;

  const override = event.override ?? {};
  const row: Record<string, unknown> = {
    title: override.title ?? rule.title(payload),
    message: override.message ?? rule.message(payload),
    module: moduleName,
    type:
      rule.priority === 'critical' || rule.priority === 'high'
        ? 'error'
        : rule.priority === 'medium'
          ? 'warning'
          : 'info',
    priority: rule.priority,
    category: override.category ?? rule.category,
    read: false,
    is_archived: false,
    event_type: event.event_type,
    entity_type: event.entity_type ?? null,
    entity_id: event.entity_id ?? null,
    actor_id: event.actor_id ?? null,
    created_by: event.actor_id ?? null,
    user_id: user_id,
    client_id: event.client_id ?? null,
    action_url: override.action_url ?? rule.action_url(payload),
    metadata: payload,
    idempotency_key: ikey,
    workspace_id: event.workspace_id ?? null,
    delivered_in_app: true,
    delivered_email: false,
  };

  try {
    const { data, error } = await db.from('notifications').insert(row).select('id').single();
    if (error) {
      // Unique constraint violation = duplicate — silently skip
      if (error.code === '23505') return null;
      console.warn('[event-engine] notification insert failed:', error.message);
      return null;
    }
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn(
      '[event-engine] notification insert unexpected:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// ── Email helper ──────────────────────────────────────────────────────────────

async function maybeSendEmail(
  db: ReturnType<typeof getServiceClient>,
  userId: string | null,
  notificationId: string | null,
  event: EngineEventInput,
  rule: EventRule,
): Promise<void> {
  const shouldSend = event.override?.send_email ?? rule.send_email;
  if (!shouldSend || !userId) return;

  try {
    // Fetch recipient email
    const { data: member } = await db
      .from('team_members')
      .select('email, full_name')
      .eq('profile_id', userId)
      .maybeSingle();
    if (!member?.email) return;

    // Check user preferences (skip if user opted out of email for this event type)
    const { data: pref } = await db
      .from('notification_preferences')
      .select('email_enabled, mute_until')
      .eq('user_id', userId)
      .eq('event_type', event.event_type)
      .maybeSingle();

    if (pref) {
      if (!pref.email_enabled) return;
      if (pref.mute_until && new Date(pref.mute_until) > new Date()) return;
    }

    const payload = event.payload ?? {};
    const override = event.override ?? {};
    const subject = override.email_subject ?? rule.email_subject?.(payload) ?? rule.title(payload);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

    const html =
      override.email_html ??
      buildGenericEmailHtml({
        recipientName: member.full_name ?? member.email,
        subject,
        title: override.title ?? rule.title(payload),
        bodyText: override.message ?? rule.message(payload),
        ctaUrl: appUrl + (override.action_url ?? rule.action_url(payload)),
        priority: rule.priority,
      });

    await sendEmail({ to: member.email, subject, html });
    void logEmailSent({
      to: member.email,
      subject,
      eventType: event.event_type,
      entityType: event.entity_type ?? undefined,
      entityId: event.entity_id ?? undefined,
    });

    // Mark notification as email-delivered
    if (notificationId) {
      void db.from('notifications').update({ delivered_email: true }).eq('id', notificationId);
    }

    // Delivery log
    if (notificationId) {
      void db.from('notification_delivery_logs').insert({
        notification_id: notificationId,
        channel: 'email',
        status: 'success',
      });
    }
  } catch (emailErr) {
    console.warn(
      '[event-engine] email failed:',
      emailErr instanceof Error ? emailErr.message : String(emailErr),
    );
    if (notificationId) {
      void db.from('notification_delivery_logs').insert({
        notification_id: notificationId,
        channel: 'email',
        status: 'failed',
        error_message: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
    }
  }
}

// ── Admin escalation ──────────────────────────────────────────────────────────

async function escalateToAdmins(
  db: ReturnType<typeof getServiceClient>,
  event: EngineEventInput,
  rule: EventRule,
): Promise<void> {
  const criticalCategories: NotificationCategory[] = ['system'];
  if (rule.priority !== 'critical' && !criticalCategories.includes(rule.category)) return;

  try {
    const { data: admins } = await db
      .from('profiles')
      .select('id')
      .in('role', ['owner', 'admin'])
      .eq('status', 'active');

    if (!admins?.length) return;
    for (const admin of admins) {
      await createNotificationForUser(db, admin.id as string, event, rule);
    }
  } catch (err) {
    console.warn(
      '[event-engine] admin escalation failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Process a workspace event:
 *  1. Log to activity timeline
 *  2. Fan out in-app notifications to recipients
 *  3. Send email notifications (per rule + preferences)
 *  4. Escalate critical events to admins
 *
 * Fire-and-forget safe — never throws.
 */
export async function processEvent(event: EngineEventInput): Promise<void> {
  try {
    const db = getServiceClient();
    const rule = EVENT_RULES[event.event_type] ?? DEFAULT_RULE;
    const recipients = (event.recipients ?? []).filter((v): v is string => Boolean(v));

    // 1. Activity log (always)
    void logActivity(db, event, rule);

    // 2. Notifications for explicit recipients
    for (const userId of recipients) {
      const notifId = await createNotificationForUser(db, userId, event, rule);
      void maybeSendEmail(db, userId, notifId, event, rule);
    }

    // 3. Broadcast notification (no specific recipient) for admin-visible events
    if (recipients.length === 0) {
      void createNotificationForUser(db, null, event, rule);
    }

    // 4. Escalate critical/system events to all admins
    void escalateToAdmins(db, event, rule);
  } catch (err) {
    console.warn(
      '[event-engine] processEvent unexpected:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

// ── Generic email template ────────────────────────────────────────────────────

function buildGenericEmailHtml(opts: {
  recipientName: string;
  subject: string;
  title: string;
  bodyText: string;
  ctaUrl: string;
  priority: NotificationPriority;
}): string {
  const colorMap: Record<NotificationPriority, string> = {
    low: '#6b7280',
    medium: '#3b82f6',
    high: '#f59e0b',
    critical: '#dc2626',
  };
  const accentColor = colorMap[opts.priority] ?? '#6366f1';
  const firstName = opts.recipientName.trim().split(/\s+/)[0] || opts.recipientName.trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${opts.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr>
          <td align="center" style="background-color:${accentColor};padding:28px 32px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">OPENY OS</h1>
            <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);font-family:Arial,Helvetica,sans-serif;">${opts.title}</p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
            <p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:#111111;">Hi ${firstName},</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">${opts.bodyText}</p>
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${accentColor};border-radius:8px;">
                  <a href="${opts.ctaUrl}" target="_blank"
                     style="display:inline-block;color:#ffffff;text-decoration:none;padding:12px 32px;font-size:15px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;border-radius:8px;">
                    View in OPENY OS →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#999999;">
              Button not working? <a href="${opts.ctaUrl}" style="color:${accentColor};">${opts.ctaUrl}</a>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;padding:16px 32px 24px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;border-bottom:1px solid #e0e0e0;border-radius:0 0 12px 12px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaaaaa;">&copy; ${new Date().getFullYear()} OPENY OS. You're receiving this because of your workspace settings.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
