/**
 * PATCH /api/publishing-schedules/[id]
 *   Update a publishing schedule (reschedule, change status, edit fields).
 *   When status changes to 'published', the linked task is updated too.
 *
 * DELETE /api/publishing-schedules/[id]
 *   Delete a publishing schedule (and unlink from task, but keep task).
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { PUBLISHING_SCHEDULE_COLUMNS } from '@/lib/supabase-list-columns';

const VALID_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'linkedin',
  'twitter',
  'snapchat',
  'youtube_shorts',
] as const;

const VALID_POST_TYPES = ['post', 'reel', 'carousel', 'story'] as const;

const VALID_STATUSES = [
  'scheduled',
  'queued',
  'published',
  'missed',
  'cancelled',
  // legacy values kept for backward compat
  'draft',
  'pending_review',
  'approved',
] as const;

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const db = getServiceClient();

    // Fetch current record
    const { data: existing, error: fetchErr } = await db
      .from('publishing_schedules')
      .select(PUBLISHING_SCHEDULE_COLUMNS)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    // Build update payload from allowed fields
    const updates: Record<string, unknown> = {};

    if (typeof body.scheduled_date === 'string' && body.scheduled_date) {
      updates.scheduled_date = body.scheduled_date;
    }
    if (typeof body.scheduled_time === 'string' && body.scheduled_time) {
      updates.scheduled_time = body.scheduled_time;
    }
    if (typeof body.timezone === 'string' && body.timezone) {
      updates.timezone = body.timezone;
    }
    if (Array.isArray(body.platforms)) {
      updates.platforms = (body.platforms as unknown[]).filter(
        (p): p is string =>
          typeof p === 'string' && (VALID_PLATFORMS as readonly string[]).includes(p),
      );
    }
    if (Array.isArray(body.post_types)) {
      updates.post_types = (body.post_types as unknown[]).filter(
        (pt): pt is string =>
          typeof pt === 'string' && (VALID_POST_TYPES as readonly string[]).includes(pt),
      );
    }
    if ('caption' in body)
      updates.caption = typeof body.caption === 'string' ? body.caption || null : null;
    if ('notes' in body) updates.notes = typeof body.notes === 'string' ? body.notes || null : null;
    if ('assigned_to' in body) {
      updates.assigned_to = typeof body.assigned_to === 'string' ? body.assigned_to || null : null;
      updates.assignee_name =
        typeof body.assignee_name === 'string' ? body.assignee_name || null : null;
    }
    if (typeof body.reminder_minutes === 'number') {
      updates.reminder_minutes = body.reminder_minutes;
    }
    if (typeof body.status === 'string') {
      const rawStatus = body.status;
      if ((VALID_STATUSES as readonly string[]).includes(rawStatus)) {
        updates.status = rawStatus;
        // When transitioning to published, stamp published_at
        if (rawStatus === 'published' && !existing.published_at) {
          updates.published_at = new Date().toISOString();
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 },
      );
    }

    const { data: updated, error: updateErr } = await db
      .from('publishing_schedules')
      .update(updates)
      .eq('id', id)
      .select(PUBLISHING_SCHEDULE_COLUMNS)
      .single();

    if (updateErr || !updated) {
      console.error('[PATCH /api/publishing-schedules/[id]] error:', updateErr?.message);
      return NextResponse.json(
        { success: false, error: updateErr?.message ?? 'Failed to update schedule' },
        { status: 500 },
      );
    }

    // ── Sync linked task when relevant fields change ─────────────────────────
    if (existing.task_id) {
      const taskUpdates: Record<string, unknown> = {};

      // When published → mark task completed (success path)
      // When cancelled → also mark task completed (it will no longer be actioned)
      if (updates.status === 'published' || updates.status === 'cancelled') {
        taskUpdates.status = 'completed';
      }

      // When rescheduled → update task due date
      if (updates.scheduled_date) taskUpdates.due_date = updates.scheduled_date;

      if (Object.keys(taskUpdates).length > 0) {
        await db.from('tasks').update(taskUpdates).eq('id', existing.task_id);
      }
    }

    // ── Activity log (best-effort) ────────────────────────────────────────────
    if (updates.status) {
      void db
        .from('activity_log')
        .insert({
          type: `publishing_${updates.status}`,
          description: `Publishing schedule status changed to "${updates.status}"`,
          user_id: auth.profile.id,
          user_uuid: auth.profile.id,
          client_id: existing.client_id ?? null,
          entity_type: 'publishing_schedule',
          entity_id: id,
        })
        .then(({ error: actErr }) => {
          if (actErr) console.warn('[publishing-schedules] activity log failed:', actErr.message);
        });
    }

    return NextResponse.json({ success: true, schedule: updated });
  } catch (err) {
    console.error('[PATCH /api/publishing-schedules/[id]] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const db = getServiceClient();

    const { error } = await db.from('publishing_schedules').delete().eq('id', id);

    if (error) {
      console.error('[DELETE /api/publishing-schedules/[id]] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/publishing-schedules/[id]] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
