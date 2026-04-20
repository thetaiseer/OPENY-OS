/**
 * Notification service — creates in-app notification records.
 * Called as a side effect from API routes.
 * Never throws — failures are logged but do not affect the main flow.
 */

import { getServiceClient } from '@/lib/supabase/service-client';

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
}

async function insertNotificationWithFallback(row: Record<string, unknown>): Promise<void> {
  const db = getServiceClient();
  const candidates: Record<string, unknown>[] = [
    row,
    (() => {
      const { metadata: _metadata, ...rest } = row;
      return rest;
    })(),
    (() => {
      const { actor_id: _actorId, ...rest } = row;
      return rest;
    })(),
    (() => {
      const { metadata: _metadata, actor_id: _actorId, ...rest } = row;
      return rest;
    })(),
  ];

  for (const candidate of candidates) {
    const { error } = await db.from('notifications').insert(candidate);
    if (!error) return;
    const msg = error.message.toLowerCase();
    const isMissingColumn = msg.includes('column') || msg.includes('schema cache');
    if (!isMissingColumn) {
      console.warn('[notification-service] insert failed:', error.message);
      return;
    }
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await insertNotificationWithFallback({
      title:       input.title,
      message:     input.message,
      type:        input.type ?? 'info',
      read:        false,
      event_type:  input.eventType ?? input.event_type ?? null,
      user_id:     input.userId ?? input.user_id ?? null,
      actor_id:    input.actorId ?? input.actor_id ?? null,
      metadata:    input.metadata ?? {},
      client_id:   input.client_id ?? null,
      task_id:     input.task_id ?? null,
      entity_type: input.entity_type ?? null,
      entity_id:   input.entity_id ?? null,
      action_url:  input.actionUrl ?? input.action_url ?? null,
    });
  } catch (err) {
    console.warn('[notification-service] unexpected error:', err instanceof Error ? err.message : String(err));
  }
}

async function createNotificationsForUsers(
  userIds: Array<string | null | undefined>,
  input: Omit<CreateNotificationInput, 'userId' | 'user_id'>,
): Promise<void> {
  const unique = [...new Set(userIds.filter((v): v is string => Boolean(v)))];
  await Promise.allSettled(unique.map(userId => createNotification({ ...input, userId })));
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
  const url = `/my-tasks`;
  const promises: Promise<void>[] = [];

  // Notify the assignee (if different from creator)
  if (opts.assignedToId && opts.assignedToId !== opts.createdById) {
    promises.push(createNotification({
      title:       'New Task Assigned',
      message:     `You have been assigned: "${opts.taskTitle}"${opts.clientName ? ` for ${opts.clientName}` : ''}`,
      type:        'info',
      event_type:  'task_assigned',
      user_id:     opts.assignedToId,
      client_id:   opts.clientId,
      task_id:     opts.taskId,
      entity_type: 'task',
      entity_id:   opts.taskId,
      action_url:  url,
    }));
  }

  // General team notification (no specific user)
  promises.push(createNotification({
    title:       'Task Created',
    message:     `Task "${opts.taskTitle}" was created${opts.clientName ? ` for ${opts.clientName}` : ''}`,
    type:        'success',
    event_type:  'task_created',
    user_id:     null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'task',
    entity_id:   opts.taskId,
    action_url:  url,
  }));

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
    title:       'Task Updated',
    message:     `"${opts.taskTitle}" — ${opts.updatedField} changed to ${opts.newValue}`,
    type:        'info',
    event_type:  'task_updated',
    user_id:     opts.assignedToId ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'task',
    entity_id:   opts.taskId,
    action_url:  `/my-tasks`,
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
    title:       'Publishing Scheduled',
    message:     `Content scheduled for ${opts.scheduledDate}${platformText}${opts.clientName ? ` — ${opts.clientName}` : ''}`,
    type:        'success',
    event_type:  'publishing_scheduled',
    client_id:   opts.clientId,
    task_id:     opts.taskId ?? null,
    entity_type: 'publishing_schedule',
    entity_id:   opts.scheduleId,
    action_url:  `/calendar`,
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
    title:       'Asset Uploaded',
    message:     `File "${opts.assetName}" uploaded successfully`,
    type:        'success',
    eventType:   'file.uploaded',
    actorId:     opts.uploadedById ?? null,
    metadata:    { assetId: opts.assetId, assetName: opts.assetName },
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'asset',
    entity_id:   opts.assetId,
    actionUrl:   `/assets`,
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
    title:       'Team Invitation Sent',
    message:     `${opts.inviteeName} was invited to join as ${opts.role}${opts.inviterName ? ` by ${opts.inviterName}` : ''}`,
    type:        'info',
    eventType:   'member.invited',
    userId:      opts.inviteeUserId ?? null,
    metadata:    { teamMemberId: opts.teamMemberId, role: opts.role },
    entity_id:   opts.teamMemberId,
    entity_type: 'team_member',
    actionUrl:   `/team`,
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
    userId:      opts.ownerId,
    title:       'Task Completed',
    message:     `"${opts.taskTitle}" has been completed.`,
    type:        'success',
    eventType:   'task.completed',
    actorId:     opts.actorId ?? null,
    metadata:    { taskId: opts.taskId },
    client_id:   opts.clientId ?? null,
    task_id:     opts.taskId,
    entity_type: 'task',
    entity_id:   opts.taskId,
    actionUrl:   '/my-tasks',
  });
}

export async function notifyClientCreated(opts: {
  clientId: string;
  clientName: string;
  actorId?: string | null;
  adminUserIds: string[];
}): Promise<void> {
  await createNotificationsForUsers(opts.adminUserIds, {
    title:       'New Client Created',
    message:     `"${opts.clientName}" was added to the system.`,
    type:        'info',
    eventType:   'client.created',
    actorId:     opts.actorId ?? null,
    metadata:    { clientId: opts.clientId, clientName: opts.clientName },
    client_id:   opts.clientId,
    entity_type: 'client',
    entity_id:   opts.clientId,
    actionUrl:   `/clients`,
  });
}

export async function notifyMemberJoined(opts: {
  joinedUserId: string;
  joinedName?: string | null;
  adminUserIds: string[];
}): Promise<void> {
  await createNotificationsForUsers(opts.adminUserIds, {
    title:       'New Team Member Joined',
    message:     `${opts.joinedName?.trim() || 'A team member'} has joined the workspace.`,
    type:        'success',
    eventType:   'member.joined',
    actorId:     opts.joinedUserId,
    metadata:    { joinedUserId: opts.joinedUserId, joinedName: opts.joinedName ?? null },
    entity_type: 'team_member',
    entity_id:   opts.joinedUserId,
    actionUrl:   `/team`,
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
    title:       'New Comment',
    message:     `${opts.actorName?.trim() || 'Someone'} commented: "${opts.content.slice(0, 120)}"`,
    type:        'info',
    eventType:   'comment.added',
    actorId:     opts.actorId,
    metadata:    { commentId: opts.commentId, taskId: opts.taskId ?? null, assetId: opts.assetId ?? null },
    task_id:     opts.taskId ?? null,
    entity_type: opts.taskId ? 'task' : opts.assetId ? 'asset' : 'comment',
    entity_id:   opts.taskId ?? opts.assetId ?? opts.commentId,
    actionUrl:   opts.taskId ? '/my-tasks' : '/assets',
  });
}
