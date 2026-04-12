/**
 * PATCH /api/calendar-events/[id]
 *   Update a calendar event (title, dates, status, notes).
 *
 * DELETE /api/calendar-events/[id]
 *   Delete a calendar event.
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';


const VALID_EVENT_TYPES = ['task', 'publishing', 'deadline', 'meeting', 'reminder', 'other'] as const;
const VALID_STATUSES    = ['active', 'cancelled', 'completed'] as const;

interface Params { id: string }

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
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

    const updates: Record<string, unknown> = {};

    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim();
    }
    if (typeof body.starts_at === 'string' && body.starts_at.trim()) {
      updates.starts_at = body.starts_at.trim();
    }
    if ('ends_at' in body) {
      updates.ends_at = typeof body.ends_at === 'string' ? body.ends_at.trim() || null : null;
    }
    if ('notes' in body) {
      updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
    }
    if (typeof body.event_type === 'string') {
      const et = body.event_type;
      if ((VALID_EVENT_TYPES as readonly string[]).includes(et)) {
        updates.event_type = et;
      }
    }
    if (typeof body.status === 'string') {
      const st = body.status;
      if ((VALID_STATUSES as readonly string[]).includes(st)) {
        updates.status = st;
      }
    }
    if (typeof body.client_id === 'string') {
      updates.client_id = body.client_id.trim() || null;
    }
    if (typeof body.task_id === 'string') {
      updates.task_id = body.task_id.trim() || null;
    }
    if (typeof body.publishing_schedule_id === 'string') {
      updates.publishing_schedule_id = body.publishing_schedule_id.trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await db
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select('*, client:clients(id,name), task:tasks(id,title,status,priority)')
      .single();

    if (error || !data) {
      console.error('[PATCH /api/calendar-events/[id]] error:', error?.message);
      return NextResponse.json(
        { success: false, error: error?.message ?? 'Calendar event not found' },
        { status: error?.code === 'PGRST116' ? 404 : 500 },
      );
    }

    return NextResponse.json({ success: true, event: data });
  } catch (err) {
    console.error('[PATCH /api/calendar-events/[id]] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const db = getServiceClient();

    const { error } = await db
      .from('calendar_events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[DELETE /api/calendar-events/[id]] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/calendar-events/[id]] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
