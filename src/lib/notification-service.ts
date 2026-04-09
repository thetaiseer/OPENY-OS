/**
 * Notification service — creates in-app notification records.
 * Called as a side effect from API routes.
 * Never throws — failures are logged but do not affect the main flow.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
  | 'approval_requested'
  | 'approval_approved'
  | 'approval_rejected'
  | 'approval_needs_changes'
  | 'asset_uploaded'
  | 'asset_linked'
  | 'client_created'
  | 'team_invitation';

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  event_type?: NotificationEventType;
  user_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
}

function getDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('[notification-service] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const db = getDb();
    const { error } = await db.from('notifications').insert({
      title:       input.title,
      message:     input.message,
      type:        input.type ?? 'info',
      read:        false,
      event_type:  input.event_type ?? null,
      user_id:     input.user_id ?? null,
      client_id:   input.client_id ?? null,
      task_id:     input.task_id ?? null,
      entity_type: input.entity_type ?? null,
      entity_id:   input.entity_id ?? null,
      action_url:  input.action_url ?? null,
    });
    if (error) {
      console.warn('[notification-service] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[notification-service] unexpected error:', err instanceof Error ? err.message : String(err));
  }
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

export async function notifyApprovalRequested(opts: {
  taskId: string;
  taskTitle: string;
  reviewerId?: string | null;
  clientId?: string | null;
  approvalId: string;
}): Promise<void> {
  await createNotification({
    title:       'Approval Requested',
    message:     `Review requested for: "${opts.taskTitle}"`,
    type:        'warning',
    event_type:  'approval_requested',
    user_id:     opts.reviewerId ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'approval',
    entity_id:   opts.approvalId,
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
}): Promise<void> {
  await createNotification({
    title:       'Asset Uploaded',
    message:     `File "${opts.assetName}" uploaded successfully`,
    type:        'success',
    event_type:  'asset_uploaded',
    user_id:     opts.uploadedById ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'asset',
    entity_id:   opts.assetId,
    action_url:  `/assets`,
  });
}

export async function notifyApprovalDecision(opts: {
  approvalId: string;
  taskId?: string | null;
  taskTitle?: string | null;
  decision: 'approved' | 'rejected' | 'needs_changes';
  decidedByName?: string | null;
  requestedById?: string | null;
  clientId?: string | null;
}): Promise<void> {
  const labels: Record<string, string> = {
    approved:      'Approved',
    rejected:      'Rejected',
    needs_changes: 'Needs Changes',
  };
  const types: Record<string, 'success' | 'error' | 'warning'> = {
    approved:      'success',
    rejected:      'error',
    needs_changes: 'warning',
  };
  const label = labels[opts.decision] ?? opts.decision;
  const type  = types[opts.decision]  ?? 'info';
  const eventMap: Record<string, NotificationEventType> = {
    approved:      'approval_approved',
    rejected:      'approval_rejected',
    needs_changes: 'approval_needs_changes',
  };
  await createNotification({
    title:       `Task ${label}`,
    message:     opts.taskTitle
      ? `"${opts.taskTitle}" has been ${label.toLowerCase()}${opts.decidedByName ? ` by ${opts.decidedByName}` : ''}`
      : `Your approval request was ${label.toLowerCase()}`,
    type,
    event_type:  eventMap[opts.decision],
    user_id:     opts.requestedById ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId ?? null,
    entity_type: 'approval',
    entity_id:   opts.approvalId,
    action_url:  `/my-tasks`,
  });
}

export async function notifyInvitation(opts: {
  teamMemberId: string;
  inviteeName: string;
  inviterName?: string | null;
  role: string;
}): Promise<void> {
  // Broadcast team-wide notification (user_id null = all users see it)
  await createNotification({
    title:       'Team Invitation Sent',
    message:     `${opts.inviteeName} was invited to join as ${opts.role}${opts.inviterName ? ` by ${opts.inviterName}` : ''}`,
    type:        'info',
    event_type:  'team_invitation',
    entity_id:   opts.teamMemberId,
    action_url:  `/team`,
  });
}
