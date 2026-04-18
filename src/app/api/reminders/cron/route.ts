/**
 * GET /api/reminders/cron
 *
 * Daily reminder processor — runs once per day at 08:00 UTC via Vercel cron.
 *
 * Compatible with Vercel Hobby plan (max 2 daily cron jobs).
 *
 * Strategy — event-driven job queue:
 *   1. Process pending `reminder_jobs` rows (due_soon, overdue_1h, overdue_24h,
 *      pre_publish) that were scheduled when events happened (task created,
 *      publishing scheduled). No polling of the full tasks table.
 *   2. For `overdue_daily` jobs: fire notification and self-renew for tomorrow.
 *   3. For `pre_publish` jobs: fire a "you have content to publish today" alert.
 *   4. Lightweight continued-overdue scan for tasks overdue > 48 h that have no
 *      active overdue_daily job (safety net for tasks created before this system).
 *   5. Send daily digest emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { dispatchNotification, scheduleReminderJobs } from '@/lib/notification-service';
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

interface ReminderJobRow {
  id: string;
  entity_type: string;
  entity_id: string;
  job_type: string;
  execute_at: string;
  user_id: string | null;
  client_id: string | null;
  status: string;
  metadata_json: Record<string, unknown> | null;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  assignee_id: string | null;
  client_id: string | null;
  status: string;
}

interface Member {
  profile_id: string | null;
  full_name: string | null;
  email: string;
}

// ── Process pending reminder_jobs ─────────────────────────────────────────────

async function processPendingJobs(
  db: ReturnType<typeof getServiceClient>,
  now: Date,
  managerIds: string[],
): Promise<{ processed: number; renewed: number; errors: number }> {
  const { data: jobs, error: fetchErr } = await db
    .from('reminder_jobs')
    .select('id,entity_type,entity_id,job_type,execute_at,user_id,client_id,status,metadata_json')
    .eq('status', 'pending')
    .lte('execute_at', now.toISOString())
    .limit(500);

  if (fetchErr) {
    console.error('[reminders/cron] fetch reminder_jobs error:', fetchErr.message);
    return { processed: 0, renewed: 0, errors: 1 };
  }

  let processed = 0;
  let renewed = 0;
  let errors = 0;

  for (const rawJob of (jobs ?? []) as ReminderJobRow[]) {
    try {
      await handleJob(db, rawJob, now, managerIds);
      processed++;

      // Self-renew overdue_daily jobs for tomorrow.
      if (rawJob.job_type === 'overdue_daily') {
        // Check if the task is still outstanding before renewing.
        if (rawJob.entity_type === 'task') {
          const { data: task } = await db
            .from('tasks')
            .select('status')
            .eq('id', rawJob.entity_id)
            .maybeSingle();
          const isTerminal = !task || TERMINAL_STATUSES.includes(String(task.status));
          if (!isTerminal) {
            await db.from('reminder_jobs').insert({
              entity_type:   rawJob.entity_type,
              entity_id:     rawJob.entity_id,
              job_type:      'overdue_daily',
              execute_at:    new Date(now.getTime() + MS_PER_DAY).toISOString(),
              user_id:       rawJob.user_id ?? null,
              client_id:     rawJob.client_id ?? null,
              status:        'pending',
              metadata_json: rawJob.metadata_json ?? null,
            });
            renewed++;
          }
        }
      }

      // Mark job as processed.
      await db
        .from('reminder_jobs')
        .update({ status: 'processed', processed_at: now.toISOString() })
        .eq('id', rawJob.id);
    } catch (err) {
      console.error('[reminders/cron] job error:', rawJob.id, err);
      errors++;
    }
  }

  return { processed, renewed, errors };
}

async function handleJob(
  db: ReturnType<typeof getServiceClient>,
  job: ReminderJobRow,
  now: Date,
  managerIds: string[],
): Promise<void> {
  if (job.entity_type === 'task') {
    await handleTaskJob(db, job, now, managerIds);
  } else if (job.entity_type === 'publishing_schedule') {
    await handlePublishJob(db, job, now, managerIds);
  }
}

async function handleTaskJob(
  db: ReturnType<typeof getServiceClient>,
  job: ReminderJobRow,
  now: Date,
  managerIds: string[],
): Promise<void> {
  const { data: task } = await db
    .from('tasks')
    .select('id,title,due_date,assignee_id,client_id,status')
    .eq('id', job.entity_id)
    .maybeSingle();

  if (!task) return;
  if (TERMINAL_STATUSES.includes(String(task.status))) return;

  const meta = (job.metadata_json ?? {}) as Record<string, unknown>;
  const taskTitle = String((meta.title as string | null) ?? (task as TaskRow).title ?? 'Task');

  if (job.job_type === 'due_soon') {
    await dispatchNotification({
      title: 'Task Due Soon',
      message: `"${taskTitle}" is due within 24 hours`,
      type: 'warning',
      category: 'task',
      priority: 'high',
      event_type: 'task_due_soon',
      user_id: job.user_id,
      client_id: job.client_id,
      task_id: job.entity_id,
      entity_type: 'task',
      entity_id: job.entity_id,
      action_url: '/my-tasks',
      dedupe_key: `task_due_soon:${job.entity_id}:${now.toISOString().slice(0, 10)}`,
      send_email: Boolean(job.user_id),
      email_subject: `Task Due Soon: ${taskTitle}`,
    });
  } else if (job.job_type === 'overdue_1h') {
    await dispatchNotification({
      title: 'Task Overdue',
      message: `"${taskTitle}" is past its due date`,
      type: 'error',
      category: 'task',
      priority: 'high',
      event_type: 'task_overdue',
      user_id: job.user_id,
      client_id: job.client_id,
      task_id: job.entity_id,
      entity_type: 'task',
      entity_id: job.entity_id,
      action_url: '/my-tasks',
      dedupe_key: `task_overdue:${job.entity_id}:1h`,
      send_email: Boolean(job.user_id),
      email_subject: `Overdue Task Reminder: ${taskTitle}`,
    });
  } else if (job.job_type === 'overdue_24h') {
    await dispatchNotification({
      title: 'Task Overdue — 24 Hours',
      message: `"${taskTitle}" has been overdue for 24 hours`,
      type: 'error',
      category: 'task',
      priority: 'high',
      event_type: 'task_overdue',
      user_id: job.user_id,
      client_id: job.client_id,
      task_id: job.entity_id,
      entity_type: 'task',
      entity_id: job.entity_id,
      action_url: '/my-tasks',
      dedupe_key: `task_overdue:${job.entity_id}:24h`,
      send_email: Boolean(job.user_id),
      email_subject: `Overdue Task Reminder (24h): ${taskTitle}`,
    });
  } else if (job.job_type === 'overdue_daily') {
    const dueTime = new Date((task as TaskRow).due_date).getTime();
    const daysOverdue = Math.max(2, Math.floor((now.getTime() - dueTime) / MS_PER_DAY));
    const priority = daysOverdue >= 3 ? 'critical' : 'high';

    await dispatchNotification({
      title: 'Task Still Overdue',
      message: `"${taskTitle}" has been overdue for ${daysOverdue} day(s)`,
      type: 'error',
      category: 'task',
      priority,
      event_type: 'task_overdue',
      user_id: job.user_id,
      client_id: job.client_id,
      task_id: job.entity_id,
      entity_type: 'task',
      entity_id: job.entity_id,
      action_url: '/my-tasks',
      dedupe_key: `task_overdue:${job.entity_id}:daily:${now.toISOString().slice(0, 10)}`,
      send_email: Boolean(job.user_id),
      email_subject: `Overdue Task (Day ${daysOverdue}): ${taskTitle}`,
    });

    // Escalate to managers when overdue >= 3 days.
    if (daysOverdue >= 3) {
      for (const managerId of managerIds) {
        if (managerId === job.user_id) continue;
        await dispatchNotification({
          title: 'Escalation: Task Long Overdue',
          message: `"${taskTitle}" has been overdue for ${daysOverdue} day(s)`,
          type: 'error',
          category: 'task',
          priority: 'critical',
          event_type: 'task_overdue',
          user_id: managerId,
          client_id: job.client_id,
          task_id: job.entity_id,
          entity_type: 'task',
          entity_id: job.entity_id,
          action_url: '/tasks/all',
          dedupe_key: `task_escalation:${job.entity_id}:${daysOverdue}:${managerId}`,
          send_email: true,
          email_subject: `Escalation: ${taskTitle} is ${daysOverdue} days overdue`,
        });
      }
    }
  }
}

async function handlePublishJob(
  db: ReturnType<typeof getServiceClient>,
  job: ReminderJobRow,
  now: Date,
  managerIds: string[],
): Promise<void> {
  if (job.job_type !== 'pre_publish') return;

  const { data: schedule } = await db
    .from('publishing_schedules')
    .select('id,scheduled_date,scheduled_time,client_name,platforms,status,task_id')
    .eq('id', job.entity_id)
    .maybeSingle();

  if (!schedule) return;
  const terminalStatuses = ['published', 'cancelled', 'missed'];
  if (terminalStatuses.includes(String(schedule.status))) return;

  const meta = (job.metadata_json ?? {}) as Record<string, unknown>;
  const clientName = String((meta.client_name as string | null) ?? schedule.client_name ?? 'client');
  const platforms = (meta.platforms as string[] | null) ?? (schedule.platforms as string[] | null) ?? [];
  const platformText = platforms.join(', ') || 'platform';
  const publishTime = schedule.scheduled_time ?? '';

  const message = `You have content to publish today at ${publishTime} for ${clientName} on ${platformText}.`;

  await dispatchNotification({
    title: 'Reminder: Content Publishes Today',
    message,
    type: 'warning',
    category: 'content',
    priority: 'high',
    event_type: 'publishing_about_to_publish',
    user_id: job.user_id,
    client_id: job.client_id,
    task_id: schedule.task_id ?? null,
    entity_type: 'publishing_schedule',
    entity_id: job.entity_id,
    action_url: '/calendar',
    dedupe_key: `pre_publish:${job.entity_id}:${schedule.scheduled_date}`,
    send_email: Boolean(job.user_id),
    email_subject: `Reminder: Scheduled publish today at ${publishTime}`,
  });

  // Alert managers.
  for (const managerId of managerIds) {
    if (managerId === job.user_id) continue;
    await dispatchNotification({
      title: 'Moderator Alert: Content Publishes Today',
      message: `"${clientName}" content publishes at ${publishTime} on ${platformText}`,
      type: 'warning',
      category: 'content',
      priority: 'high',
      event_type: 'publishing_about_to_publish',
      user_id: managerId,
      client_id: job.client_id,
      task_id: schedule.task_id ?? null,
      entity_type: 'publishing_schedule',
      entity_id: job.entity_id,
      action_url: '/calendar',
      dedupe_key: `moderator_publish_alert:${job.entity_id}:${schedule.scheduled_date}:${managerId}`,
      send_email: true,
      email_subject: `Moderator Alert: ${clientName} publishes today`,
    });
  }
}

// ── Safety net: legacy overdue tasks (no reminder_jobs entry) ─────────────────

async function processLegacyOverdue(
  db: ReturnType<typeof getServiceClient>,
  now: Date,
  managerIds: string[],
): Promise<{ count: number; errors: number }> {
  // Only look for tasks overdue > 48h that have NO pending/processed overdue_daily job.
  // This handles tasks created before the reminder_jobs system was deployed.
  const cutoff = new Date(now.getTime() - 48 * MS_PER_HOUR).toISOString();
  const { data: overdue } = await db
    .from('tasks')
    .select('id,title,due_date,assignee_id,client_id,status')
    .lt('due_date', cutoff)
    .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
    .limit(100);

  if (!overdue?.length) return { count: 0, errors: 0 };

  // Filter to those with no reminder_jobs entry at all.
  const ids = (overdue as TaskRow[]).map(t => t.id);
  const { data: existing } = await db
    .from('reminder_jobs')
    .select('entity_id')
    .eq('entity_type', 'task')
    .in('entity_id', ids)
    .in('job_type', ['overdue_daily', 'overdue_1h', 'overdue_24h']);

  const hasJob = new Set((existing ?? []).map((r: Record<string, unknown>) => r.entity_id as string));

  let count = 0;
  let errors = 0;
  for (const task of (overdue as TaskRow[])) {
    if (hasJob.has(task.id)) continue;
    try {
      // Insert reminder_jobs so next run picks them up via the queue.
      const due = new Date(task.due_date);
      await scheduleReminderJobs({
        entityType: 'task',
        entityId:   task.id,
        userId:     task.assignee_id,
        clientId:   task.client_id,
        dueAt:      due,
        metadata:   { title: task.title },
      });
      count++;
    } catch (err) {
      console.error('[reminders/cron] legacy overdue schedule error:', err);
      errors++;
    }
  }
  return { count, errors };
}

// ── Daily digest emails ───────────────────────────────────────────────────────

async function sendDailyDigests(db: ReturnType<typeof getServiceClient>, now: Date): Promise<number> {
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

    const [{ data: pending }, { data: overdueData }] = await Promise.all([
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

    // Skip users with nothing to report.
    if (!(pending ?? []).length && !(overdueData ?? []).length) continue;

    const subject = 'OPENY OS — Daily Task Summary';
    try {
      await sendEmail({
        to: member.email,
        subject,
        html: dailyTaskDigestEmail({
          recipientName: member.full_name ?? member.email,
          pendingTasks:  (pending ?? []).map(p => String((p as { title?: string }).title ?? 'Task')),
          overdueTasks:  (overdueData ?? []).map(t => String((t as { title?: string }).title ?? 'Task')),
          appUrl,
        }),
      });
      void logEmailSent({ to: member.email, subject, eventType: 'daily_digest', entityType: 'task' });
      sent++;
    } catch (err) {
      void logEmailSent({ to: member.email, subject, eventType: 'daily_digest', entityType: 'task', status: 'failed', error: String(err) });
    }
  }
  return sent;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const db = getServiceClient();
  const now = new Date();

  // Fetch manager/admin IDs for escalation notifications.
  const { data: managerRows } = await db
    .from('team_members')
    .select('profile_id')
    .in('role', ['admin', 'manager'])
    .not('profile_id', 'is', null)
    .limit(100);
  const managerIds = (managerRows ?? [])
    .map(r => (r as { profile_id?: string | null }).profile_id)
    .filter((id): id is string => Boolean(id));

  // 1. Process event-driven reminder_jobs.
  const { processed, renewed, errors: jobErrors } = await processPendingJobs(db, now, managerIds);

  // 2. Safety net for legacy tasks (creates reminder_jobs for them; handled next run).
  const { count: legacyCount, errors: legacyErrors } = await processLegacyOverdue(db, now, managerIds);

  // 3. Daily digest emails.
  const digests = await sendDailyDigests(db, now);

  return NextResponse.json({
    success: true,
    processed,
    renewed,
    legacyScheduled: legacyCount,
    digests,
    errors: jobErrors + legacyErrors,
  });
}

