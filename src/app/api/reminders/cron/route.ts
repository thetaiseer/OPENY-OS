/**
 * GET /api/reminders/cron
 *
 * Scheduled job that processes all time-sensitive reminders:
 *   1. Tasks due within 24 hours   → "due soon" alert + email
 *   2. Overdue tasks               → "overdue" alert + email
 *   3. Content publishing soon     → publish-window alert (15m / 60m before)
 *   4. Stale tasks                 → not updated in STALE_TASK_DAYS days
 *
 * All notification inserts use idempotency_key dedup to prevent flooding.
 *
 * Security: protected by CRON_SECRET env var (header x-cron-secret or ?secret=…).
 * Schedule: Vercel Cron at 08:00 UTC daily + separate 15-min cron for publish windows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { createNotification } from '@/lib/notification-service';
import { sendEmail, deadlineAlertEmail, logEmailSent } from '@/lib/email';
import { runAutomationsAcrossWorkspaces } from '@/lib/automations/runner';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'published', 'delivered'];
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;
const STALE_TASK_DAYS = 7; // alert when task has no update for this many days

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
  updated_at?: string;
  assignee_id: string | null;
  client_id: string | null;
  status: string;
}

interface PublishRow {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  timezone: string;
  client_id: string | null;
  client_name: string | null;
  assigned_to: string | null;
  status: string;
}

interface AssigneeMember {
  profile_id: string | null;
  full_name: string | null;
  email: string;
}

async function resolveAssignees(
  db: ReturnType<typeof getServiceClient>,
  assigneeIds: string[],
): Promise<Map<string, AssigneeMember>> {
  const map = new Map<string, AssigneeMember>();
  if (!assigneeIds.length) return map;
  const { data } = await db
    .from('team_members')
    .select('profile_id, full_name, email')
    .in('profile_id', assigneeIds);
  for (const m of data ?? []) {
    if (m.profile_id) map.set(m.profile_id as string, m as AssigneeMember);
  }
  return map;
}

/** Build an idempotency key for a reminder notification.
 * Format: `{type}:{entityId}:{userId}:{windowSegment}`
 * where windowSegment changes per window size to allow re-notifications.
 */
function buildReminderIkey(
  type: string,
  entityId: string,
  userId: string | null,
  window: 'day' | 'hour' | '15min',
) {
  const now = new Date();
  let windowStr: string;
  if (window === 'day')
    windowStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
  else if (window === 'hour')
    windowStr = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
  else windowStr = `${now.toISOString().slice(0, 13)}:${Math.floor(now.getMinutes() / 15) * 15}`;
  return `${type}:${entityId}:${userId ?? 'all'}:${windowStr}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const db = getServiceClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const now = new Date();
  const in24h = new Date(now.getTime() + MS_PER_DAY);

  let dueSoonCount = 0;
  let overdueCount = 0;
  let publishCount = 0;
  let staleCount = 0;
  let errors = 0;
  let automationActions = 0;

  try {
    // ── 1. Tasks due within the next 24 hours ─────────────────────────────────
    const { data: dueSoon } = await db
      .from('tasks')
      .select('id, title, due_date, assignee_id, client_id, status')
      .gt('due_date', now.toISOString())
      .lte('due_date', in24h.toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)
      .limit(100);

    const dueSoonIds = (dueSoon ?? [])
      .map((t: Record<string, string | null>) => t.assignee_id)
      .filter((id): id is string => !!id);
    const dueSoonAssignees = await resolveAssignees(db, dueSoonIds);

    for (const task of (dueSoon ?? []) as TaskRow[]) {
      try {
        const daysLeft = Math.max(
          1,
          Math.ceil((new Date(task.due_date).getTime() - now.getTime()) / MS_PER_DAY),
        );
        const userId = task.assignee_id ?? null;
        await createNotification({
          title: 'Task Due Soon',
          message: `"${task.title}" is due in ${daysLeft <= 0 ? 'less than a day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}`,
          type: 'warning',
          priority: 'medium',
          category: 'tasks',
          event_type: 'task_due_soon',
          user_id: userId,
          client_id: task.client_id ?? null,
          task_id: task.id,
          entity_type: 'task',
          entity_id: task.id,
          action_url: '/os/tasks',
          idempotency_key: buildReminderIkey('task_due_soon', task.id, userId, 'day'),
        });
        dueSoonCount++;

        // Send email to assignee
        const assignee = userId ? (dueSoonAssignees.get(userId) ?? null) : null;
        if (assignee?.email && appUrl) {
          try {
            await sendEmail({
              to: assignee.email,
              subject: `⏰ Task due soon: ${task.title}`,
              html: deadlineAlertEmail({
                recipientName: assignee.full_name ?? assignee.email,
                taskTitle: task.title,
                daysLeft,
                appUrl,
              }),
            });
            void logEmailSent({
              to: assignee.email,
              subject: `Task due soon: ${task.title}`,
              eventType: 'task_due_soon',
              entityType: 'task',
              entityId: task.id,
            });
          } catch (emailErr) {
            void logEmailSent({
              to: assignee.email,
              subject: `Task due soon: ${task.title}`,
              eventType: 'task_due_soon',
              entityType: 'task',
              entityId: task.id,
              status: 'failed',
              error: String(emailErr),
            });
          }
        }
      } catch (err) {
        console.error('[reminders/cron] due-soon task error:', task.id, err);
        errors++;
      }
    }

    // ── 2. Overdue tasks ──────────────────────────────────────────────────────
    const { data: overdue } = await db
      .from('tasks')
      .select('id, title, due_date, assignee_id, client_id, status')
      .lt('due_date', now.toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)
      .limit(100);

    const overdueIds = (overdue ?? [])
      .map((t: Record<string, string | null>) => t.assignee_id)
      .filter((id): id is string => !!id);
    const overdueAssignees = await resolveAssignees(db, overdueIds);

    for (const task of (overdue ?? []) as TaskRow[]) {
      try {
        const userId = task.assignee_id ?? null;
        await createNotification({
          title: 'Task Overdue',
          message: `"${task.title}" is overdue`,
          type: 'error',
          priority: 'high',
          category: 'tasks',
          event_type: 'task_overdue',
          user_id: userId,
          client_id: task.client_id ?? null,
          task_id: task.id,
          entity_type: 'task',
          entity_id: task.id,
          action_url: '/os/tasks',
          idempotency_key: buildReminderIkey('task_overdue', task.id, userId, 'day'),
        });
        overdueCount++;

        // Send overdue email to assignee
        const assignee = userId ? (overdueAssignees.get(userId) ?? null) : null;
        if (assignee?.email && appUrl) {
          try {
            await sendEmail({
              to: assignee.email,
              subject: `🚨 Task overdue: ${task.title}`,
              html: deadlineAlertEmail({
                recipientName: assignee.full_name ?? assignee.email,
                taskTitle: task.title,
                daysLeft: 0,
                appUrl,
              }),
            });
            void logEmailSent({
              to: assignee.email,
              subject: `Task overdue: ${task.title}`,
              eventType: 'task_overdue',
              entityType: 'task',
              entityId: task.id,
            });
          } catch (emailErr) {
            void logEmailSent({
              to: assignee.email,
              subject: `Task overdue: ${task.title}`,
              eventType: 'task_overdue',
              entityType: 'task',
              entityId: task.id,
              status: 'failed',
              error: String(emailErr),
            });
          }
        }
      } catch (err) {
        console.error('[reminders/cron] overdue task error:', task.id, err);
        errors++;
      }
    }

    // ── 3. Content publish-window reminders (15m and 1h before) ───────────────
    // Fetch publishing schedules whose publish time is within the next 15 minutes
    // that have not been published yet.
    const { data: upcoming15m } = await db
      .from('publishing_schedules')
      .select(
        'id, scheduled_date, scheduled_time, timezone, client_id, client_name, assigned_to, status',
      )
      .in('status', ['scheduled', 'queued'])
      .limit(50);

    for (const sched of (upcoming15m ?? []) as PublishRow[]) {
      try {
        const schedDt = new Date(`${sched.scheduled_date}T${sched.scheduled_time}`);
        const msUntil = schedDt.getTime() - now.getTime();

        // 15-minute window: 0 < msUntil <= 15 * MS_PER_MINUTE
        const in15Window = msUntil > 0 && msUntil <= 15 * MS_PER_MINUTE;
        // 1-hour window: 15 * MS_PER_MINUTE < msUntil <= MS_PER_HOUR
        const in1hWindow = msUntil > 15 * MS_PER_MINUTE && msUntil <= MS_PER_HOUR;

        if (!in15Window && !in1hWindow) continue;

        const windowLabel = in15Window ? '15 minutes' : '1 hour';
        const windowKey = in15Window ? '15min' : 'hour';
        const userId = sched.assigned_to ?? null;

        await createNotification({
          title: '📅 Publish Window Approaching',
          message: `Content is scheduled to publish in ~${windowLabel}${sched.client_name ? ` — ${sched.client_name}` : ''}`,
          type: 'warning',
          priority: 'high',
          category: 'content',
          eventType: 'publish_window.approaching',
          user_id: userId,
          client_id: sched.client_id ?? null,
          entity_type: 'publishing_schedule',
          entity_id: sched.id,
          action_url: '/os/calendar',
          idempotency_key: buildReminderIkey(
            'publish_window',
            sched.id,
            userId,
            windowKey as 'hour' | '15min',
          ),
        });
        publishCount++;

        // Send email reminder to the assigned user
        if (userId && appUrl) {
          const { data: member } = await db
            .from('team_members')
            .select('email, full_name')
            .eq('profile_id', userId)
            .maybeSingle();
          if (member?.email) {
            try {
              const subj = `📅 Content publishing in ~${windowLabel}`;
              await sendEmail({
                to: member.email,
                subject: subj,
                html: publishWindowEmail({
                  recipientName: member.full_name ?? member.email,
                  windowLabel,
                  clientName: sched.client_name ?? undefined,
                  scheduledDate: sched.scheduled_date,
                  scheduledTime: sched.scheduled_time,
                  appUrl,
                }),
              });
              void logEmailSent({
                to: member.email,
                subject: subj,
                eventType: 'publish_window.approaching',
                entityType: 'publishing_schedule',
                entityId: sched.id,
              });
            } catch (emailErr) {
              console.warn(
                '[reminders/cron] publish window email failed:',
                emailErr instanceof Error ? emailErr.message : String(emailErr),
              );
            }
          }
        }
      } catch (err) {
        console.error('[reminders/cron] publish window error:', sched.id, err);
        errors++;
      }
    }

    // ── 4. Stale tasks (no update in STALE_TASK_DAYS days) ────────────────────
    const staleThreshold = new Date(now.getTime() - STALE_TASK_DAYS * MS_PER_DAY).toISOString();
    const { data: staleTasks } = await db
      .from('tasks')
      .select('id, title, assignee_id, client_id, status, updated_at')
      .lt('updated_at', staleThreshold)
      .not('status', 'in', `(${TERMINAL_STATUSES.map((s) => `"${s}"`).join(',')})`)
      .limit(50);

    for (const task of (staleTasks ?? []) as TaskRow[]) {
      try {
        const userId = task.assignee_id ?? null;
        await createNotification({
          title: 'Task Has No Recent Updates',
          message: `"${task.title}" has not been updated in ${STALE_TASK_DAYS}+ days`,
          type: 'warning',
          priority: 'medium',
          category: 'tasks',
          eventType: 'task.stale',
          user_id: userId,
          client_id: task.client_id ?? null,
          task_id: task.id,
          entity_type: 'task',
          entity_id: task.id,
          action_url: '/os/tasks',
          idempotency_key: buildReminderIkey('task_stale', task.id, userId, 'day'),
        });
        staleCount++;
      } catch (err) {
        console.error('[reminders/cron] stale task error:', task.id, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('[reminders/cron] unexpected error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }

  try {
    const automationResults = await runAutomationsAcrossWorkspaces();
    automationActions = automationResults.reduce((sum, row) => sum + row.actions, 0);
  } catch (err) {
    console.error('[reminders/cron] automations error:', err);
    errors++;
  }

  return NextResponse.json({
    success: true,
    dueSoonCount,
    overdueCount,
    publishCount,
    staleCount,
    automationActions,
    errors,
  });
}

// ── Email template for publish-window reminder ────────────────────────────────

function publishWindowEmail(opts: {
  recipientName: string;
  windowLabel: string;
  clientName?: string;
  scheduledDate: string;
  scheduledTime: string;
  appUrl: string;
}): string {
  const firstName = opts.recipientName.trim().split(/\s+/)[0] || opts.recipientName;
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Publishing Soon</title></head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="background-color:#7c3aed;padding:28px 32px;border-radius:12px 12px 0 0;">
          <h1 style="margin:0;font-size:22px;font-weight:bold;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">OPENY OS</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">📅 Content Publishing Soon</p>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:32px;border:1px solid #e0e0e0;border-top:none;">
          <p style="margin:0 0 16px;font-size:17px;font-weight:bold;color:#111111;">Hi ${firstName},</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444444;line-height:1.6;">
            Content is scheduled to publish in approximately <strong style="color:#7c3aed;">${opts.windowLabel}</strong>.
          </p>
          <div style="background:#f7f3ff;border:1px solid #ddd6fe;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
            ${opts.clientName ? `<p style="margin:0 0 6px;color:#555;font-size:14px;">Client: <strong>${opts.clientName}</strong></p>` : ''}
            <p style="margin:0;color:#555;font-size:14px;">Scheduled: <strong>${opts.scheduledDate} at ${opts.scheduledTime}</strong></p>
          </div>
          <table cellpadding="0" cellspacing="0" border="0">
            <tr><td style="background-color:#7c3aed;border-radius:8px;">
              <a href="${opts.appUrl}/os/calendar" target="_blank"
                 style="display:inline-block;color:#ffffff;text-decoration:none;padding:12px 28px;font-size:14px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;border-radius:8px;">
                View Calendar →
              </a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:#ffffff;padding:12px 32px 20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
          <p style="margin:0;font-size:11px;color:#aaaaaa;">&copy; ${new Date().getFullYear()} OPENY OS</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
