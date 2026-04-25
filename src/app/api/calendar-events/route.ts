/**
 * GET /api/calendar-events
 *   List calendar events with optional filters.
 *   Query params:
 *     client_id              — filter by client
 *     event_type             — filter by type (task, publishing, deadline, meeting, reminder, other)
 *     status                 — filter by status (active, cancelled, completed)
 *     date_from              — starts_at >= date_from (ISO date string)
 *     date_to                — starts_at <= date_to   (ISO date string)
 *     task_id                — filter events for a specific task
 *     publishing_schedule_id — filter events for a specific schedule
 *
 * POST /api/calendar-events
 *   Create a new calendar event.
 *   Body: { title, starts_at, event_type?, ends_at?, client_id?, task_id?,
 *            publishing_schedule_id?, status?, notes? }
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { CALENDAR_EVENT_WITH_RELATIONS } from '@/lib/supabase-list-columns';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

const VALID_EVENT_TYPES = [
  'task',
  'publishing',
  'deadline',
  'meeting',
  'reminder',
  'other',
] as const;
const VALID_STATUSES = ['active', 'cancelled', 'completed'] as const;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const eventType = searchParams.get('event_type');
  const status = searchParams.get('status');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const taskId = searchParams.get('task_id');
  const publishingScheduleId = searchParams.get('publishing_schedule_id');

  try {
    const db = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      db,
      auth.profile.id,
    );
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          step: 'workspace_resolution',
          error: workspaceError ?? 'Workspace not found',
        },
        { status: 500 },
      );
    }

    let query = db
      .from('calendar_events')
      .select(CALENDAR_EVENT_WITH_RELATIONS)
      .eq('workspace_id', workspaceId)
      .order('starts_at', { ascending: true });

    if (clientId) query = query.eq('client_id', clientId);
    if (eventType) query = query.eq('event_type', eventType);
    if (status) query = query.eq('status', status);
    if (dateFrom) query = query.gte('starts_at', dateFrom);
    if (dateTo) query = query.lte('starts_at', dateTo);
    if (taskId) query = query.eq('task_id', taskId);
    if (publishingScheduleId) query = query.eq('publishing_schedule_id', publishingScheduleId);

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/calendar-events] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: data ?? [] });
  } catch (err) {
    console.error('[GET /api/calendar-events] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const startsAt = typeof body.starts_at === 'string' ? body.starts_at.trim() : '';

  if (!title) {
    return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
  }
  if (!startsAt) {
    return NextResponse.json({ success: false, error: 'starts_at is required' }, { status: 400 });
  }

  const rawEventType = typeof body.event_type === 'string' ? body.event_type : 'task';
  const eventType = (VALID_EVENT_TYPES as readonly string[]).includes(rawEventType)
    ? rawEventType
    : 'task';

  const rawStatus = typeof body.status === 'string' ? body.status : 'active';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'active';

  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : '';
  const taskId = typeof body.task_id === 'string' ? body.task_id.trim() : '';
  const publishingScheduleId =
    typeof body.publishing_schedule_id === 'string' ? body.publishing_schedule_id.trim() : '';
  const endsAt = typeof body.ends_at === 'string' ? body.ends_at.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  const insertPayload: Record<string, unknown> = {
    title,
    starts_at: startsAt,
    event_type: eventType,
    status,
    client_id: clientId || null,
    task_id: taskId || null,
    publishing_schedule_id: publishingScheduleId || null,
    ends_at: endsAt || null,
    notes: notes || null,
  };

  try {
    const db = getServiceClient();
    const { workspaceId, error: workspaceError } = await resolveWorkspaceForRequest(
      req,
      db,
      auth.profile.id,
    );
    if (!workspaceId) {
      return NextResponse.json(
        {
          success: false,
          step: 'workspace_resolution',
          error: workspaceError ?? 'Workspace not found',
        },
        { status: 500 },
      );
    }
    insertPayload.workspace_id = workspaceId;

    const { data, error } = await db
      .from('calendar_events')
      .insert(insertPayload)
      .select(CALENDAR_EVENT_WITH_RELATIONS)
      .single();

    if (error) {
      console.error('[POST /api/calendar-events] db error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, event: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/calendar-events] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
