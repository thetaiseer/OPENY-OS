/**
 * GET /api/reminders/cron
 *
 * Scheduled job that:
 *   1. Finds tasks due within 24 hours (not yet completed/cancelled) → "due soon" alert
 *   2. Finds tasks that are overdue (due_date < now, not completed/cancelled) → "overdue" alert
 *   3. Creates an in-app notification per task (deduplicates via a created_at window)
 *   4. Sends a deadline alert email to the assignee (if available)
 *
 * Security: protected by CRON_SECRET env var (header x-cron-secret or query ?secret=…).
 * Schedule: run once per day via Vercel Cron (see vercel.json). Runs at 08:00 UTC.
 *
 * Vercel Cron config:
 *   { "path": "/api/reminders/cron", "schedule": "0 8 * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createNotification } from '@/lib/notification-service';
import { sendEmail, deadlineAlertEmail, logEmailSent } from '@/lib/email';

const TERMINAL_STATUSES = ['completed', 'cancelled', 'published', 'delivered'];
const MS_PER_DAY = 86_400_000;

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

function isAuthorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // not configured — open (dev mode)
  const headerSecret = req.headers.get('x-cron-secret');
  const querySecret  = new URL(req.url).searchParams.get('secret');
  return headerSecret === secret || querySecret === secret;
}

interface TaskRow {
  id: string;
  title: string;
  due_date: string;
  assignee_id: string | null;
  client_id: string | null;
  status: string;
  assignee?: { id: string; name: string | null; email: string }[] | null;
}

export async function GET(req: NextRequest) {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const db      = getDb();
  const appUrl  = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  const now     = new Date();
  const in24h   = new Date(now.getTime() + MS_PER_DAY);

  let dueSoonCount = 0;
  let overdueCount = 0;
  let errors       = 0;

  try {
    // ── 1. Tasks due within the next 24 hours ─────────────────────────────────
    const { data: dueSoon } = await db
      .from('tasks')
      .select('id, title, due_date, assignee_id, client_id, status, assignee:profiles!tasks_assignee_id_fkey(id,name,email)')
      .gt('due_date',  now.toISOString())
      .lte('due_date', in24h.toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
      .limit(100);

    for (const task of (dueSoon ?? []) as TaskRow[]) {
      try {
        const daysLeft = Math.max(1, Math.ceil((new Date(task.due_date).getTime() - now.getTime()) / MS_PER_DAY));
        await createNotification({
          title:       'Task Due Soon',
          message:     `"${task.title}" is due in ${daysLeft <= 0 ? 'less than a day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}`,
          type:        'warning',
          event_type:  'task_due_soon',
          user_id:     task.assignee_id ?? null,
          client_id:   task.client_id ?? null,
          task_id:     task.id,
          entity_type: 'task',
          entity_id:   task.id,
          action_url:  '/my-tasks',
        });
        dueSoonCount++;

        // Send email to assignee
        const assignee = task.assignee?.[0] ?? null;
        if (assignee?.email && appUrl) {
          try {
            await sendEmail({
              to:      assignee.email,
              subject: `⏰ Task due soon: ${task.title}`,
              html:    deadlineAlertEmail({
                recipientName: assignee.name ?? assignee.email,
                taskTitle:     task.title,
                daysLeft,
                appUrl,
              }),
            });
            void logEmailSent({ to: assignee.email, subject: `Task due soon: ${task.title}`, eventType: 'task_due_soon', entityType: 'task', entityId: task.id });
          } catch (emailErr) {
            void logEmailSent({ to: assignee.email, subject: `Task due soon: ${task.title}`, eventType: 'task_due_soon', entityType: 'task', entityId: task.id, status: 'failed', error: String(emailErr) });
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
      .select('id, title, due_date, assignee_id, client_id, status, assignee:profiles!tasks_assignee_id_fkey(id,name,email)')
      .lt('due_date', now.toISOString())
      .not('status', 'in', `(${TERMINAL_STATUSES.map(s => `"${s}"`).join(',')})`)
      .limit(100);

    for (const task of (overdue ?? []) as TaskRow[]) {
      try {
        await createNotification({
          title:       'Task Overdue',
          message:     `"${task.title}" is overdue`,
          type:        'error',
          event_type:  'task_overdue',
          user_id:     task.assignee_id ?? null,
          client_id:   task.client_id ?? null,
          task_id:     task.id,
          entity_type: 'task',
          entity_id:   task.id,
          action_url:  '/my-tasks',
        });
        overdueCount++;

        // Send overdue email to assignee
        const assignee = task.assignee?.[0] ?? null;
        if (assignee?.email && appUrl) {
          try {
            await sendEmail({
              to:      assignee.email,
              subject: `🚨 Task overdue: ${task.title}`,
              html:    deadlineAlertEmail({
                recipientName: assignee.name ?? assignee.email,
                taskTitle:     task.title,
                daysLeft:      0,
                appUrl,
              }),
            });
            void logEmailSent({ to: assignee.email, subject: `Task overdue: ${task.title}`, eventType: 'task_overdue', entityType: 'task', entityId: task.id });
          } catch (emailErr) {
            void logEmailSent({ to: assignee.email, subject: `Task overdue: ${task.title}`, eventType: 'task_overdue', entityType: 'task', entityId: task.id, status: 'failed', error: String(emailErr) });
          }
        }
      } catch (err) {
        console.error('[reminders/cron] overdue task error:', task.id, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('[reminders/cron] unexpected error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }

  console.log(`[reminders/cron] done — dueSoon:${dueSoonCount} overdue:${overdueCount} errors:${errors}`);
  return NextResponse.json({ success: true, dueSoonCount, overdueCount, errors });
}
