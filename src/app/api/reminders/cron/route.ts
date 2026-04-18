/**
 * GET /api/reminders/cron
 *
 * Enterprise reminder processor:
 * - due soon reminders
 * - overdue reminder cadence: 1h, 24h, then daily
 * - publish-about-to-go-live alerts (+ moderator/admin heads-up)
 * - escalation for long-overdue tasks
 * - daily digest (08:00 UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { dispatchNotification } from '@/lib/notification-service';
import { dailyTaskDigestEmail, logEmailSent, sendEmail } from '@/lib/email';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'published', 'delivered', 'done'];
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const headerSecret = req.headers.get('x-cron-secret');
  const querySecret = new URL(req.url).searchParams.get('secret');
  return headerSecret === secret || querySecret === secret;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  assignee_id: string | null;
  client_id: string | null;
  status: string;
}

interface ScheduleRow {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  timezone: string | null;
  reminder_minutes: number | null;
  assigned_to: string | null;
  client_id: string | null;
  client_name: string | null;
  platforms: string[] | null;
  status: string;
  task_id: string | null;
}

interface Member {
  profile_id: string | null;
  full_name: string | null;
  email: string;
  role?: string | null;
}

async function resolveMembers(db: ReturnType<typeof getServiceClient>, profileIds: string[]): Promise<Map<string, Member>> {
  const map = new Map<string, Member>();
  if (profileIds.length === 0) return map;
  const { data } = await db
    .from('team_members')
    .select('profile_id, full_name, email, role')
    .in('profile_id', profileIds);
  for (const row of data ?? []) {
    if (row.profile_id) map.set(row.profile_id as string, row as Member);
  }
  return map;
}

async function sendDailyDigests(db: ReturnType<typeof getServiceClient>, now: Date): Promise<number> {
  if (now.getUTCHours() !== 8) return 0;
  const { data: members } = await db
    .from('team_members')
    .select('profile_id, full_name, email')
    .not('profile_id', 'is', null)
    .limit(300);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  if (!appUrl || !members?.length) return 0;

  let sent = 0;
  for (const member of members as Member[]) {
    if (!member.profile_id || !member.email) continue;
    const since = new Date(now.getTime() - MS_PER_DAY).toISOString();
    const [{ data: pending }, { data: overdue }] = await Promise.all([
      db
        .from('tasks')
        .select('title')
        .eq('assignee_id', member.profile_id)
        .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
        .order('due_date', { ascending: true })
        .limit(8),
      db
        .from('tasks')
        .select('title')
        .eq('assignee_id', member.profile_id)
        .lt('due_date', now.toISOString())
        .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
        .order('due_date', { ascending: true })
        .limit(8),
    ]);

    const subject = 'OPENY OS — Daily Task Summary';
    try {
      await sendEmail({
        to: member.email,
        subject,
        html: dailyTaskDigestEmail({
          recipientName: member.full_name ?? member.email,
          pendingTasks: (pending ?? []).map(p => String((p as { title?: string }).title ?? 'Task')),
          overdueTasks: (overdue ?? []).map(t => String((t as { title?: string }).title ?? 'Task')),
          appUrl,
        }),
      });
      void logEmailSent({
        to: member.email,
        subject,
        eventType: 'daily_digest',
        entityType: 'task',
      });
      sent++;
    } catch (err) {
      void logEmailSent({
        to: member.email,
        subject,
        eventType: 'daily_digest',
        entityType: 'task',
        status: 'failed',
        error: String(err),
      });
    }

    // lightweight anti-spam: skip if no updates in last 24h and no pending/overdue
    if ((pending ?? []).length === 0 && (overdue ?? []).length === 0) {
      const { data: recentActivity } = await db
        .from('activities')
        .select('id')
        .eq('user_uuid', member.profile_id)
        .gte('created_at', since)
        .limit(1);
      if ((recentActivity ?? []).length === 0) continue;
    }
  }
  return sent;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const db = getServiceClient();
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * MS_PER_HOUR);
  let dueSoonCount = 0;
  let overdueCount = 0;
  let publishAlertCount = 0;
  let escalations = 0;
  let digests = 0;
  let errors = 0;

  try {
    const { data: dueSoon } = await db
      .from('tasks')
      .select('id, title, due_date, assignee_id, client_id, status')
      .gt('due_date', now.toISOString())
      .lte('due_date', in24h.toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
      .limit(300);

    for (const task of (dueSoon ?? []) as TaskRow[]) {
      try {
        const dedupeDay = now.toISOString().slice(0, 10);
        await dispatchNotification({
          title: 'Task Due Soon',
          message: `"${task.title}" is due soon`,
          type: 'warning',
          category: 'task',
          priority: 'high',
          event_type: 'task_due_soon',
          user_id: task.assignee_id ?? null,
          client_id: task.client_id ?? null,
          task_id: task.id,
          entity_type: 'task',
          entity_id: task.id,
          action_url: '/my-tasks',
          dedupe_key: `task_due_soon:${task.id}:${dedupeDay}`,
          send_email: Boolean(task.assignee_id),
          email_subject: `Task Due Soon: ${task.title}`,
        });
        dueSoonCount++;
      } catch (err) {
        console.error('[reminders/cron] due-soon error:', err);
        errors++;
      }
    }

    const { data: overdue } = await db
      .from('tasks')
      .select('id, title, due_date, assignee_id, client_id, status')
      .lt('due_date', now.toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
      .limit(500);

    const { data: managerRows } = await db
      .from('team_members')
      .select('profile_id')
      .in('role', ['admin', 'manager'])
      .not('profile_id', 'is', null)
      .limit(100);
    const managerIds = (managerRows ?? [])
      .map(r => (r as { profile_id?: string | null }).profile_id)
      .filter((id): id is string => Boolean(id));

    for (const task of (overdue ?? []) as TaskRow[]) {
      try {
        const dueTime = new Date(task.due_date).getTime();
        const hoursOverdue = Math.floor((now.getTime() - dueTime) / MS_PER_HOUR);
        const daysOverdue = Math.max(1, Math.floor((now.getTime() - dueTime) / MS_PER_DAY));
        const intervals: Array<{ key: string; match: boolean; label: string }> = [
          { key: '1h', match: hoursOverdue >= 1 && hoursOverdue < 24, label: '1 hour overdue' },
          { key: '24h', match: hoursOverdue >= 24 && hoursOverdue < 48, label: '24 hours overdue' },
          { key: `daily:${daysOverdue}`, match: hoursOverdue >= 48, label: `${daysOverdue} day(s) overdue` },
        ];
        const hit = intervals.find(i => i.match);
        if (!hit) continue;

        await dispatchNotification({
          title: 'Task Overdue',
          message: `"${task.title}" is ${hit.label}`,
          type: 'error',
          category: 'task',
          priority: hoursOverdue >= 72 ? 'critical' : 'high',
          event_type: 'task_overdue',
          user_id: task.assignee_id ?? null,
          client_id: task.client_id ?? null,
          task_id: task.id,
          entity_type: 'task',
          entity_id: task.id,
          action_url: '/my-tasks',
          dedupe_key: `task_overdue:${task.id}:${hit.key}`,
          send_email: Boolean(task.assignee_id),
          email_subject: `Overdue Task Reminder: ${task.title}`,
        });
        overdueCount++;

        if (hoursOverdue >= 72) {
          for (const managerId of managerIds) {
            await dispatchNotification({
              title: 'Escalation: Task Long Overdue',
              message: `"${task.title}" has been overdue for ${daysOverdue} day(s)`,
              type: 'error',
              category: 'task',
              priority: 'critical',
              event_type: 'task_overdue',
              user_id: managerId,
              client_id: task.client_id ?? null,
              task_id: task.id,
              entity_type: 'task',
              entity_id: task.id,
              action_url: '/tasks/all',
              dedupe_key: `task_escalation:${task.id}:${daysOverdue}`,
              send_email: true,
              email_subject: `Escalation: ${task.title} is long overdue`,
            });
          }
          escalations++;
        }
      } catch (err) {
        console.error('[reminders/cron] overdue error:', err);
        errors++;
      }
    }

    const { data: schedules } = await db
      .from('publishing_schedules')
      .select('id,scheduled_date,scheduled_time,timezone,reminder_minutes,assigned_to,client_id,client_name,platforms,status,task_id')
      .in('status', ['scheduled', 'queued'])
      .limit(300);

    const moderatorMap = await resolveMembers(db, managerIds);
    for (const schedule of (schedules ?? []) as ScheduleRow[]) {
      try {
        const reminderMins = schedule.reminder_minutes ?? 15;
        const publishAt = new Date(`${schedule.scheduled_date}T${schedule.scheduled_time ?? '09:00:00'}Z`).getTime();
        const remainingMs = publishAt - now.getTime();
        if (remainingMs < 0 || remainingMs > reminderMins * 60_000) continue;

        const platformText = (schedule.platforms ?? []).join(', ') || 'platforms';
        const message = `Your post for ${schedule.client_name ?? 'client'} is scheduled at ${schedule.scheduled_time ?? ''} on ${platformText}.`;

        await dispatchNotification({
          title: 'Content About to Publish',
          message,
          type: 'warning',
          category: 'content',
          priority: 'high',
          event_type: 'publishing_about_to_publish',
          user_id: schedule.assigned_to ?? null,
          client_id: schedule.client_id ?? null,
          task_id: schedule.task_id ?? null,
          entity_type: 'publishing_schedule',
          entity_id: schedule.id,
          action_url: '/calendar',
          dedupe_key: `publish_about_to:${schedule.id}:${schedule.scheduled_date}:${schedule.scheduled_time ?? ''}`,
          send_email: Boolean(schedule.assigned_to),
          email_subject: `Reminder: Scheduled publish at ${schedule.scheduled_time ?? ''}`,
        });

        for (const [managerId] of moderatorMap) {
          await dispatchNotification({
            title: 'Moderator Alert: Scheduled Content',
            message: `"${schedule.client_name ?? 'Client'}" content scheduled at ${schedule.scheduled_time ?? ''} (${platformText})`,
            type: 'warning',
            category: 'content',
            priority: 'high',
            event_type: 'publishing_about_to_publish',
            user_id: managerId,
            client_id: schedule.client_id ?? null,
            task_id: schedule.task_id ?? null,
            entity_type: 'publishing_schedule',
            entity_id: schedule.id,
            action_url: '/calendar',
            dedupe_key: `moderator_publish_alert:${schedule.id}:${schedule.scheduled_date}:${schedule.scheduled_time ?? ''}`,
            send_email: true,
            email_subject: 'Moderator Alert: Content about to publish',
          });
        }
        publishAlertCount++;
      } catch (err) {
        console.error('[reminders/cron] publishing alert error:', err);
        errors++;
      }
    }

    digests = await sendDailyDigests(db, now);
  } catch (err) {
    console.error('[reminders/cron] unexpected error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    dueSoonCount,
    overdueCount,
    publishAlertCount,
    escalations,
    digests,
    errors,
  });
}
