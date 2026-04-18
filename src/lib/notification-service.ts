/**
 * Notification service — centralized notification dispatch for in-app + email.
 * Never throws — failures are logged but do not affect primary request flow.
 */

import { getServiceClient } from '@/lib/supabase/service-client';
import { genericNotificationEmail, logEmailSent, sendEmail } from '@/lib/email';

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
  | 'publishing_about_to_publish'
  | 'asset_uploaded'
  | 'asset_linked'
  | 'client_created'
  | 'client_updated'
  | 'team_invitation'
  | 'team_joined'
  | 'activity';

export type NotificationCategory = 'task' | 'content' | 'system' | 'team';
export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

interface NotificationPreferences {
  email_task?: boolean;
  email_content?: boolean;
  email_team?: boolean;
  email_system?: boolean;
  dnd_until?: string | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export interface CreateNotificationInput {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  category?: NotificationCategory;
  priority?: NotificationPriority;
  event_type?: NotificationEventType;
  user_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
  dedupe_key?: string | null;
  metadata_json?: Record<string, unknown> | null;
  delivery_channels?: string[] | null;
  dedupe_window_minutes?: number;
}

export interface DispatchNotificationInput extends CreateNotificationInput {
  send_email?: boolean;
  email_subject?: string;
  email_html?: string;
  email_dedupe_window_minutes?: number;
}

function isDndActive(prefs: NotificationPreferences | null): boolean {
  if (!prefs?.dnd_until) return false;
  return new Date(prefs.dnd_until).getTime() > Date.now();
}

function isWithinQuietHours(prefs: NotificationPreferences | null): boolean {
  const start = prefs?.quiet_hours_start;
  const end = prefs?.quiet_hours_end;
  if (!start || !end) return false;
  const now = new Date();
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  if (Number.isNaN(sH) || Number.isNaN(sM) || Number.isNaN(eH) || Number.isNaN(eM)) return false;
  const startMin = sH * 60 + sM;
  const endMin = eH * 60 + eM;
  if (startMin <= endMin) return nowMin >= startMin && nowMin < endMin;
  return nowMin >= startMin || nowMin < endMin;
}

function categoryEmailEnabled(category: NotificationCategory | undefined, prefs: NotificationPreferences | null): boolean {
  switch (category) {
    case 'task': return prefs?.email_task ?? true;
    case 'content': return prefs?.email_content ?? true;
    case 'team': return prefs?.email_team ?? true;
    case 'system':
    default: return prefs?.email_system ?? true;
  }
}

async function getPrefs(userId: string): Promise<NotificationPreferences | null> {
  try {
    const db = getServiceClient();
    const { data } = await db
      .from('notification_preferences')
      .select('email_task,email_content,email_team,email_system,dnd_until,quiet_hours_start,quiet_hours_end')
      .eq('user_id', userId)
      .maybeSingle();
    return (data ?? null) as NotificationPreferences | null;
  } catch {
    return null;
  }
}

async function resolveUserEmail(userId: string): Promise<{ email: string; name: string } | null> {
  const db = getServiceClient();
  try {
    const { data: member } = await db
      .from('team_members')
      .select('email,full_name')
      .eq('profile_id', userId)
      .maybeSingle();
    if (member?.email) {
      return { email: member.email as string, name: (member.full_name as string | null) ?? (member.email as string) };
    }
  } catch {
    // ignore
  }
  return null;
}

async function wasRecentlyDelivered(opts: {
  channel: 'email' | 'in_app' | 'push';
  userId?: string | null;
  dedupeKey?: string | null;
  minutes: number;
}): Promise<boolean> {
  if (!opts.dedupeKey) return false;
  try {
    const db = getServiceClient();
    const since = new Date(Date.now() - opts.minutes * 60_000).toISOString();
    let q = db
      .from('notification_delivery_logs')
      .select('id')
      .eq('channel', opts.channel)
      .eq('dedupe_key', opts.dedupeKey)
      .gte('sent_at', since)
      .limit(1);
    if (opts.userId) q = q.eq('user_id', opts.userId);
    const { data } = await q;
    return Boolean(data?.length);
  } catch {
    return false;
  }
}

async function logDelivery(opts: {
  channel: 'email' | 'in_app' | 'push';
  userId?: string | null;
  recipient?: string | null;
  dedupeKey?: string | null;
  eventType?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: 'sent' | 'failed';
  error?: string | null;
}): Promise<void> {
  try {
    const db = getServiceClient();
    await db.from('notification_delivery_logs').insert({
      channel: opts.channel,
      user_id: opts.userId ?? null,
      recipient: opts.recipient ?? null,
      dedupe_key: opts.dedupeKey ?? null,
      event_type: opts.eventType ?? null,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      status: opts.status ?? 'sent',
      error: opts.error ?? null,
    });
  } catch {
    // ignore
  }
}

async function createNotificationInternal(input: CreateNotificationInput): Promise<boolean> {
  try {
    const db = getServiceClient();
    const dedupeWindow = Math.max(1, Math.min(input.dedupe_window_minutes ?? 10, 24 * 60));
    if (input.dedupe_key) {
      const since = new Date(Date.now() - dedupeWindow * 60_000).toISOString();
      let dq = db.from('notifications')
        .select('id')
        .eq('dedupe_key', input.dedupe_key)
        .gte('created_at', since)
        .limit(1);
      if (input.user_id) dq = dq.eq('user_id', input.user_id);
      const { data: dupes } = await dq;
      if ((dupes ?? []).length > 0) return false;
    }

    const row = {
      title:       input.title,
      message:     input.message,
      type:        input.type ?? 'info',
      read:        false,
      event_type:  input.event_type ?? null,
      category:    input.category ?? null,
      priority:    input.priority ?? 'medium',
      user_id:     input.user_id ?? null,
      client_id:   input.client_id ?? null,
      task_id:     input.task_id ?? null,
      entity_type: input.entity_type ?? null,
      entity_id:   input.entity_id ?? null,
      action_url:  input.action_url ?? null,
      dedupe_key:  input.dedupe_key ?? null,
      metadata_json: input.metadata_json ?? null,
      delivery_channels: input.delivery_channels ?? ['in_app'],
    };

    const { error } = await db.from('notifications').insert(row);
    if (!error) {
      await logDelivery({
        channel: 'in_app',
        userId: input.user_id ?? null,
        dedupeKey: input.dedupe_key ?? null,
        eventType: input.event_type ?? null,
        entityType: input.entity_type ?? null,
        entityId: input.entity_id ?? null,
      });
      return true;
    }

    // Backward-compatible fallback for older schemas.
    const legacyInsert = await db.from('notifications').insert({
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

    if (legacyInsert.error) {
      console.warn('[notification-service] insert failed:', legacyInsert.error.message);
      return false;
    }
    await logDelivery({
      channel: 'in_app',
      userId: input.user_id ?? null,
      dedupeKey: input.dedupe_key ?? null,
      eventType: input.event_type ?? null,
      entityType: input.entity_type ?? null,
      entityId: input.entity_id ?? null,
    });
    return true;
  } catch (err) {
    console.warn('[notification-service] unexpected error:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await createNotificationInternal(input);
}

export async function dispatchNotification(input: DispatchNotificationInput): Promise<void> {
  const inserted = await createNotificationInternal(input);
  if (!inserted) return;
  if (!input.send_email || !input.user_id) return;

  const prefs = await getPrefs(input.user_id);
  if (!categoryEmailEnabled(input.category, prefs)) return;
  if (isDndActive(prefs) || isWithinQuietHours(prefs)) return;

  const dedupeKey = input.dedupe_key ?? `${input.event_type ?? 'event'}:${input.entity_type ?? ''}:${input.entity_id ?? ''}:${input.user_id}`;
  const emailWindow = Math.max(5, Math.min(input.email_dedupe_window_minutes ?? 30, 24 * 60));
  const alreadySent = await wasRecentlyDelivered({
    channel: 'email',
    userId: input.user_id,
    dedupeKey,
    minutes: emailWindow,
  });
  if (alreadySent) return;

  const recipient = await resolveUserEmail(input.user_id);
  if (!recipient?.email) return;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const actionUrl = input.action_url ? `${appUrl}${input.action_url}` : `${appUrl}/notifications`;
  const subject = input.email_subject ?? input.title;
  const html = input.email_html ?? genericNotificationEmail({
    recipientName: recipient.name,
    title: input.title,
    message: input.message,
    ctaLabel: 'Open Notification',
    ctaUrl: actionUrl,
    accent: input.priority === 'critical' ? '#dc2626' : '#6366f1',
  });

  try {
    await sendEmail({ to: recipient.email, subject, html });
    void logEmailSent({
      to: recipient.email,
      subject,
      eventType: input.event_type,
      entityType: input.entity_type ?? undefined,
      entityId: input.entity_id ?? undefined,
    });
    await logDelivery({
      channel: 'email',
      userId: input.user_id,
      recipient: recipient.email,
      dedupeKey,
      eventType: input.event_type ?? null,
      entityType: input.entity_type ?? null,
      entityId: input.entity_id ?? null,
      status: 'sent',
    });
  } catch (emailErr) {
    void logEmailSent({
      to: recipient.email,
      subject,
      eventType: input.event_type,
      entityType: input.entity_type ?? undefined,
      entityId: input.entity_id ?? undefined,
      status: 'failed',
      error: String(emailErr),
    });
    await logDelivery({
      channel: 'email',
      userId: input.user_id,
      recipient: recipient.email,
      dedupeKey,
      eventType: input.event_type ?? null,
      entityType: input.entity_type ?? null,
      entityId: input.entity_id ?? null,
      status: 'failed',
      error: String(emailErr),
    });
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
    promises.push(dispatchNotification({
      title:       'New Task Assigned',
      message:     `You have been assigned: "${opts.taskTitle}"${opts.clientName ? ` for ${opts.clientName}` : ''}`,
      type:        'info',
      category:    'task',
      priority:    'high',
      event_type:  'task_assigned',
      user_id:     opts.assignedToId,
      client_id:   opts.clientId,
      task_id:     opts.taskId,
      entity_type: 'task',
      entity_id:   opts.taskId,
      action_url:  url,
      dedupe_key:  `task_assigned:${opts.taskId}:${opts.assignedToId}`,
      send_email:  true,
      email_subject: `Task Assigned: ${opts.taskTitle}`,
    }));
  }

  // General team notification (no specific user)
  promises.push(dispatchNotification({
    title:       'Task Created',
    message:     `Task "${opts.taskTitle}" was created${opts.clientName ? ` for ${opts.clientName}` : ''}`,
    type:        'success',
    category:    'task',
    priority:    'medium',
    event_type:  'task_created',
    user_id:     null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'task',
    entity_id:   opts.taskId,
    action_url:  url,
    dedupe_key:  `task_created:${opts.taskId}`,
  }));

  await Promise.allSettled(promises);
}

export async function notifyTaskUpdated(opts: {
  taskId: string;
  taskTitle: string;
  updatedField?: string;
  newValue?: string;
  clientId?: string | null;
  assignedToId?: string | null;
}): Promise<void> {
  await dispatchNotification({
    title:       'Task Updated',
    message:     opts.updatedField && opts.newValue
      ? `"${opts.taskTitle}" — ${opts.updatedField} changed to ${opts.newValue}`
      : `"${opts.taskTitle}" was updated`,
    type:        'info',
    category:    'task',
    priority:    'medium',
    event_type:  'task_updated',
    user_id:     opts.assignedToId ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'task',
    entity_id:   opts.taskId,
    action_url:  `/my-tasks`,
    dedupe_key:  `task_updated:${opts.taskId}:${opts.assignedToId ?? 'broadcast'}`,
    send_email:  Boolean(opts.assignedToId),
    email_subject: `Task Updated: ${opts.taskTitle}`,
  });
}

export async function notifyTaskCompleted(opts: {
  taskId: string;
  taskTitle: string;
  clientId?: string | null;
  assignedToId?: string | null;
}): Promise<void> {
  await dispatchNotification({
    title: 'Task Completed',
    message: `"${opts.taskTitle}" has been marked completed`,
    type: 'success',
    category: 'task',
    priority: 'medium',
    event_type: 'task_completed',
    user_id: opts.assignedToId ?? null,
    client_id: opts.clientId ?? null,
    task_id: opts.taskId,
    entity_type: 'task',
    entity_id: opts.taskId,
    action_url: '/my-tasks',
    dedupe_key: `task_completed:${opts.taskId}`,
    send_email: Boolean(opts.assignedToId),
    email_subject: `Task Completed: ${opts.taskTitle}`,
  });
}

export async function notifyPublishingScheduled(opts: {
  scheduleId: string;
  taskId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  scheduledDate: string;
  platforms?: string[];
  assignedToId?: string | null;
}): Promise<void> {
  const platformText = opts.platforms?.length ? ` on ${opts.platforms.join(', ')}` : '';
  await dispatchNotification({
    title:       'Publishing Scheduled',
    message:     `Content scheduled for ${opts.scheduledDate}${platformText}${opts.clientName ? ` — ${opts.clientName}` : ''}`,
    type:        'success',
    category:    'content',
    priority:    'high',
    event_type:  'publishing_scheduled',
    user_id:     opts.assignedToId ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId ?? null,
    entity_type: 'publishing_schedule',
    entity_id:   opts.scheduleId,
    action_url:  `/calendar`,
    dedupe_key:  `publishing_scheduled:${opts.scheduleId}`,
    send_email:  Boolean(opts.assignedToId),
    email_subject: `Publishing Scheduled: ${opts.clientName ?? 'Content'}`,
  });
}

export async function notifyAssetUploaded(opts: {
  assetId: string;
  assetName: string;
  clientId?: string | null;
  taskId?: string | null;
  uploadedById?: string | null;
}): Promise<void> {
  await dispatchNotification({
    title:       'Asset Uploaded',
    message:     `File "${opts.assetName}" uploaded successfully`,
    type:        'success',
    category:    'content',
    priority:    'medium',
    event_type:  'asset_uploaded',
    user_id:     opts.uploadedById ?? null,
    client_id:   opts.clientId,
    task_id:     opts.taskId,
    entity_type: 'asset',
    entity_id:   opts.assetId,
    action_url:  `/assets`,
    dedupe_key:  `asset_uploaded:${opts.assetId}:${opts.uploadedById ?? 'broadcast'}`,
  });
}

export async function notifyInvitation(opts: {
  teamMemberId: string;
  inviteeName: string;
  inviterName?: string | null;
  role: string;
}): Promise<void> {
  // Broadcast team-wide notification (user_id null = all users see it)
  await dispatchNotification({
    title:       'Team Invitation Sent',
    message:     `${opts.inviteeName} was invited to join as ${opts.role}${opts.inviterName ? ` by ${opts.inviterName}` : ''}`,
    type:        'info',
    category:    'team',
    priority:    'medium',
    event_type:  'team_invitation',
    entity_id:   opts.teamMemberId,
    action_url:  `/team`,
    dedupe_key:  `team_invitation:${opts.teamMemberId}`,
  });
}

export async function notifyTeamJoined(opts: {
  userId: string;
  memberName: string;
  role: string;
}): Promise<void> {
  await dispatchNotification({
    title: 'Team Member Joined',
    message: `${opts.memberName} joined as ${opts.role}`,
    type: 'success',
    category: 'team',
    priority: 'high',
    event_type: 'team_joined',
    user_id: null,
    entity_type: 'team_member',
    entity_id: opts.userId,
    action_url: '/team',
    dedupe_key: `team_joined:${opts.userId}`,
  });
}

export async function notifyClientCreated(opts: {
  clientId: string;
  clientName: string;
}): Promise<void> {
  await dispatchNotification({
    title: 'Client Added',
    message: `Client "${opts.clientName}" was added`,
    type: 'success',
    category: 'team',
    priority: 'medium',
    event_type: 'client_created',
    user_id: null,
    client_id: opts.clientId,
    entity_type: 'client',
    entity_id: opts.clientId,
    action_url: '/clients',
    dedupe_key: `client_created:${opts.clientId}`,
  });
}

export async function notifyClientUpdated(opts: {
  clientId: string;
  clientName: string;
}): Promise<void> {
  await dispatchNotification({
    title: 'Client Updated',
    message: `Client "${opts.clientName}" was updated`,
    type: 'info',
    category: 'team',
    priority: 'low',
    event_type: 'client_updated',
    user_id: null,
    client_id: opts.clientId,
    entity_type: 'client',
    entity_id: opts.clientId,
    action_url: '/clients',
    dedupe_key: `client_updated:${opts.clientId}`,
  });
}
