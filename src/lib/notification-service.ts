/**
 * Notification service — creates in-app notification records.
 * Called as a side effect from API routes.
 * Never throws — failures are logged but do not affect the main flow.
 *
 * For new features, prefer processEvent() from @/lib/event-engine instead.
 * This module remains for backward compatibility with existing callers.
 */

import { getServiceClient } from '@/lib/supabase/service-client';
import type { NotificationPriority, NotificationCategory } from '@/lib/types';

const COMMENT_PREVIEW_LENGTH = 120;

export type NotificationEventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_updated'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'task_published'
  | 'publishing_scheduled'
  | 'publishing_rescheduled'
  | 'publishing_published'
  | 'asset_uploaded'
  | 'asset_linked'
  | 'client_created'
  | 'team_invitation';

export interface CreateNotificationInput {
  title: string;
  message: string;
  /** UI severity style */
  type?: 'info' | 'success' | 'warning' | 'error';
  /** Canonical event type (ex: task.created) */
  eventType?: string;
  /** Backward-compatible event type alias */
  event_type?: NotificationEventType;
  /** Priority level — drives visual treatment */
  priority?: NotificationPriority;
  /** Module category for tab filtering */
  category?: NotificationCategory;
  /** Preferred recipient key */
  userId?: string | null;
  /** Backward-compatible recipient key */
  user_id?: string | null;
  actorId?: string | null;
  actor_id?: string | null;
  metadata?: Record<string, unknown> | null;
  client_id?: string | null;
  task_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  actionUrl?: string | null;
  action_url?: string | null;
  /** Idempotency key for dedup within 1-hour windows */
  idempotency_key?: string | null;
}

/** Derive category from event type string */
function inferCategory(eventType: string | undefined | null): NotificationCategory {
  if (!eventType) return 'system';
  if (eventType.startsWith('task') || eventType.startsWith('comment')) return 'tasks';
  if (
    eventType.startsWith('content') ||
    eventType.startsWith('publishing') ||
    eventType.startsWith('publish')
  )
    return 'content';
  if (
    eventType.startsWith('asset') ||
    eventType.startsWith('file') ||
    eventType.startsWith('storage')
  )
    return 'assets';
  if (
    eventType.startsWith('team') ||
    eventType.startsWith('invite') ||
    eventType.startsWith('member') ||
    eventType.startsWith('role')
  )
    return 'team';
  return 'system';
}

/** Derive priority from notification type */
function inferPriority(type: string | undefined): NotificationPriority {
  if (type === 'error') return 'high';
  if (type === 'warning') return 'medium';
  return 'low';
}

async function insertNotificationWithFallback(row: Record<string, unknown>): Promise<void> {
  const db = getServiceClient();
  const isOptionalColumnMissingError = (message: string) => {
    const msg = message.toLowerCase();
    const mentionsOptionalCol =
      msg.includes('metadata') ||
      msg.includes('actor_id') ||
      msg.includes('priority') ||
      msg.includes('category') ||
      msg.includes('is_archived') ||
      msg.includes('idempotency');
    const isMissingColumnPattern = msg.includes('column') || msg.includes('could not find');
    return isMissingColumnPattern && mentionsOptionalCol;
  };
  const omitFields = (source: Record<string, unknown>, fields: string[]) => {
    const next: Record<string, unknown> = { ...source };
    for (const field of fields) delete next[field];
    return next;
  };
  // Try progressively-stripped rows until one succeeds
  const candidates: Record<string, unknown>[] = [
    row,
    omitFields(row, [
      'priority',
      'category',
      'is_archived',
      'idempotency_key',
      'delivered_in_app',
      'delivered_email',
    ]),
    omitFields(row, ['metadata']),
    omitFields(row, ['actor_id']),
    omitFields(row, [
      'metadata',
      'actor_id',
      'priority',
      'category',
      'is_archived',
      'idempotency_key',
      'delivered_in_app',
      'delivered_email',
    ]),
  ];

  for (const candidate of candidates) {
    const { error } = await db.from('notifications').insert(candidate);
    if (!error) return;
    if (error.code === '23505') return; // duplicate idempotency key — silently skip
    const isMissingColumn = isOptionalColumnMissingError(error.message);
    if (!isMissingColumn) {
      console.warn('[notification-service] insert failed:', error.message);
      return;
    }
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const rawEventType = input.eventType ?? input.event_type ?? null;
    await insertNotificationWithFallback({
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      read: false,
      is_archived: false,
      priority: input.priority ?? inferPriority(input.type),
      category: input.category ?? inferCategory(rawEventType),
      event_type: rawEventType,
      user_id: input.userId ?? input.user_id ?? null,
      actor_id: input.actorId ?? input.actor_id ?? null,
      metadata: input.metadata ?? {},
      client_id: input.client_id ?? null,
      task_id: input.task_id ?? null,
      entity_type: input.entity_type ?? null,
      entity_id: input.entity_id ?? null,
      action_url: input.actionUrl ?? input.action_url ?? null,
      idempotency_key: input.idempotency_key ?? null,
      delivered_in_app: true,
      delivered_email: false,
    });
  } catch (err) {
    console.warn(
      '[notification-service] unexpected error:',
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function createNotificationsForUsers(
  userIds: Array<string | null | undefined>,
  input: Omit<CreateNotificationInput, 'userId' | 'user_id'>,
): Promise<void> {
  const unique = [...new Set(userIds.filter((v): v is string => Boolean(v)))];
  await Promise.allSettled(unique.map((userId) => createNotification({ ...input, userId })));
}

/** Fire a "task created + assigned" notification bundle. */
export async function notifyTaskCreated(opts: {
  taskId: string;
  taskTitle: string;
  clientId?: string | null;
  assignedToId?: string | null;
  createdById?: string | null;
  clientName?: string | null;
}): Promise<void> {
  const url = `/os/tasks`;
  const promises: Promise<void>[] = [];

  // Notify the assignee (if different from creator)
  if (opts.assignedToId && opts.assignedToId !== opts.createdById) {
    promises.push(
      createNotification({
        title: 'New Task Assigned',
        message: `You have been assigned: "${opts.taskTitle}"${opts.clientName ? ` for ${opts.clientName}` : ''}`,
        type: 'info',
        priority: 'medium',
        category: 'tasks',
        event_type: 'task_assigned',
        user_id: opts.assignedToId,
        client_id: opts.clientId,
        task_id: opts.taskId,
        entity_type: 'task',
        entity_id: opts.taskId,
        action_url: url,
        idempotency_key: `task.assigned:${opts.taskId}:${opts.assignedToId}`,
      }),
    );
  }

  // General team notification (no specific user)
  promises.push(
    createNotification({
      title: 'Task Created',
      message: `Task "${opts.taskTitle}" was created${opts.clientName ? ` for ${opts.clientName}` : ''}`,
      type: 'success',
      priority: 'low',
      category: 'tasks',
      event_type: 'task_created',
      user_id: null,
      client_id: opts.clientId,
      task_id: opts.taskId,
      entity_type: 'task',
      entity_id: opts.taskId,
      action_url: url,
    }),
  );

  await Promise.allSettled(promises);
}

export async function notifyTaskUpdated(opts: {
  taskId: string;
  taskTitle: string;
  updatedField: string;
  newValue: string;
  clientId?: string | null;
  assignedToId?: string | null;
}): Promise<void> {
  await createNotification({
    title: 'Task Updated',
    message: `"${opts.taskTitle}" — ${opts.updatedField} changed to ${opts.newValue}`,
    type: 'info',
    priority: 'low',
    category: 'tasks',
    event_type: 'task_updated',
    user_id: opts.assignedToId ?? null,
    client_id: opts.clientId,
    task_id: opts.taskId,
    entity_type: 'task',
    entity_id: opts.taskId,
    action_url: `/os/tasks`,
  });
}

export async function notifyPublishingScheduled(opts: {
  scheduleId: string;
  taskId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  scheduledDate: string;
  platforms?: string[];
}): Promise<void> {
  const platformText = opts.platforms?.length ? ` on ${opts.platforms.join(', ')}` : '';
  await createNotification({
    title: 'Publishing Scheduled',
    message: `Content scheduled for ${opts.scheduledDate}${platformText}${opts.clientName ? ` — ${opts.clientName}` : ''}`,
    type: 'success',
    priority: 'medium',
    category: 'content',
    event_type: 'publishing_scheduled',
    client_id: opts.clientId,
    task_id: opts.taskId ?? null,
    entity_type: 'publishing_schedule',
    entity_id: opts.scheduleId,
    action_url: `/os/calendar`,
  });
}

export async function notifyAssetUploaded(opts: {
  assetId: string;
  assetName: string;
  clientId?: string | null;
  taskId?: string | null;
  uploadedById?: string | null;
  teamMemberUserIds?: string[];
}): Promise<void> {
  const recipients = opts.teamMemberUserIds?.length
    ? opts.teamMemberUserIds
    : [opts.uploadedById ?? null];
  await createNotificationsForUsers(recipients, {
    title: 'Asset Uploaded',
    message: `File "${opts.assetName}" uploaded successfully`,
    type: 'success',
    priority: 'medium',
    category: 'assets',
    eventType: 'file.uploaded',
    actorId: opts.uploadedById ?? null,
    metadata: { assetId: opts.assetId, assetName: opts.assetName },
    client_id: opts.clientId,
    task_id: opts.taskId,
    entity_type: 'asset',
    entity_id: opts.assetId,
    actionUrl: `/os/assets`,
  });
}

export async function notifyInvitation(opts: {
  teamMemberId: string;
  inviteeName: string;
  inviterName?: string | null;
  role: string;
  inviteeUserId?: string | null;
}): Promise<void> {
  await createNotification({
    title: 'Team Invitation Sent',
    message: `${opts.inviteeName} was invited to join as ${opts.role}${opts.inviterName ? ` by ${opts.inviterName}` : ''}`,
    type: 'info',
    priority: 'medium',
    category: 'team',
    eventType: 'invite.sent',
    userId: opts.inviteeUserId ?? null,
    metadata: { teamMemberId: opts.teamMemberId, role: opts.role },
    entity_id: opts.teamMemberId,
    entity_type: 'team_member',
    actionUrl: `/os/team`,
    idempotency_key: opts.inviteeUserId
      ? `invite.sent:${opts.teamMemberId}:${opts.inviteeUserId}`
      : null,
  });
}

export async function notifyTaskCompleted(opts: {
  taskId: string;
  taskTitle: string;
  ownerId?: string | null;
  actorId?: string | null;
  clientId?: string | null;
}): Promise<void> {
  if (!opts.ownerId) return;
  await createNotification({
    userId: opts.ownerId,
    title: 'Task Completed',
    message: `"${opts.taskTitle}" has been completed.`,
    type: 'success',
    priority: 'low',
    category: 'tasks',
    eventType: 'task.completed',
    actorId: opts.actorId ?? null,
    metadata: { taskId: opts.taskId },
    client_id: opts.clientId ?? null,
    task_id: opts.taskId,
    entity_type: 'task',
    entity_id: opts.taskId,
    actionUrl: '/os/tasks',
    idempotency_key: `task.completed:${opts.taskId}:${opts.ownerId}`,
  });
}

export async function notifyClientCreated(opts: {
  clientId: string;
  clientName: string;
  actorId?: string | null;
  adminUserIds: string[];
}): Promise<void> {
  await createNotificationsForUsers(opts.adminUserIds, {
    title: 'New Client Created',
    message: `"${opts.clientName}" was added to the system.`,
    type: 'info',
    priority: 'low',
    category: 'system',
    eventType: 'client.created',
    actorId: opts.actorId ?? null,
    metadata: { clientId: opts.clientId, clientName: opts.clientName },
    client_id: opts.clientId,
    entity_type: 'client',
    entity_id: opts.clientId,
    actionUrl: `/os/clients`,
  });
}

export async function notifyMemberJoined(opts: {
  joinedUserId: string;
  joinedName?: string | null;
  adminUserIds: string[];
}): Promise<void> {
  await createNotificationsForUsers(opts.adminUserIds, {
    title: 'New Team Member Joined',
    message: `${opts.joinedName?.trim() || 'A team member'} has joined the workspace.`,
    type: 'success',
    priority: 'medium',
    category: 'team',
    eventType: 'member.joined',
    actorId: opts.joinedUserId,
    metadata: { joinedUserId: opts.joinedUserId, joinedName: opts.joinedName ?? null },
    entity_type: 'team_member',
    entity_id: opts.joinedUserId,
    actionUrl: `/os/team`,
  });
}

export async function notifyCommentAdded(opts: {
  commentId: string;
  content: string;
  actorId: string;
  actorName?: string | null;
  taskId?: string | null;
  assetId?: string | null;
  watcherUserIds: string[];
}): Promise<void> {
  await createNotificationsForUsers(opts.watcherUserIds, {
    title: 'New Comment',
    message: `${opts.actorName?.trim() || 'Someone'} commented: "${opts.content.slice(0, COMMENT_PREVIEW_LENGTH)}"`,
    type: 'info',
    priority: 'medium',
    category: 'tasks',
    eventType: 'comment.added',
    actorId: opts.actorId,
    metadata: {
      commentId: opts.commentId,
      taskId: opts.taskId ?? null,
      assetId: opts.assetId ?? null,
    },
    task_id: opts.taskId ?? null,
    entity_type: opts.taskId ? 'task' : opts.assetId ? 'asset' : 'comment',
    entity_id: opts.taskId ?? opts.assetId ?? opts.commentId,
    actionUrl: opts.taskId ? '/os/tasks' : '/os/assets',
  });
}
