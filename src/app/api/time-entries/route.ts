/**
 * GET  /api/time-entries   — list time entries
 * POST /api/time-entries   — create a time entry (or start a timer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const taskId    = searchParams.get('task_id');
  const clientId  = searchParams.get('client_id');
  const userId    = searchParams.get('user_id');
  const running   = searchParams.get('running');
  const since     = searchParams.get('since');

  const db = getServiceClient();
  let query = db
    .from('time_entries')
    .select('*, task:tasks(id, title), client:clients(id, name)')
    .order('started_at', { ascending: false })
    .limit(500);

  if (taskId)   query = query.eq('task_id', taskId);
  if (clientId) query = query.eq('client_id', clientId);
  if (userId)   query = query.eq('user_id', userId);
  if (running === 'true')  query = query.eq('is_running', true);
  if (running === 'false') query = query.eq('is_running', false);
  if (since)    query = query.gte('started_at', since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, entries: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const db = getServiceClient();

  // If starting a timer — stop any currently running entry for this user first
  if (body.is_running === true) {
    // Calculate duration for the timer being auto-stopped before stopping it
    const { data: runningTimers } = await db
      .from('time_entries')
      .select('id, started_at')
      .eq('user_id', auth.profile.id)
      .eq('is_running', true);

    for (const running of (runningTimers ?? []) as { id: string; started_at: string }[]) {
      const autoStopTime  = new Date().toISOString();
      const autoStopSecs  = Math.round(
        (new Date(autoStopTime).getTime() - new Date(running.started_at).getTime()) / 1000,
      );
      await db
        .from('time_entries')
        .update({ is_running: false, ended_at: autoStopTime, duration_seconds: autoStopSecs })
        .eq('id', running.id);
    }
  }

  const startedAt = typeof body.started_at === 'string' ? body.started_at : new Date().toISOString();
  const isRunning = body.is_running === true;

  // Compute duration for manual entries
  let durationSeconds: number | null = null;
  if (typeof body.duration_seconds === 'number') {
    durationSeconds = Math.round(body.duration_seconds);
  } else if (!isRunning && typeof body.ended_at === 'string') {
    durationSeconds = Math.round(
      (new Date(body.ended_at as string).getTime() - new Date(startedAt).getTime()) / 1000,
    );
  }

  const payload: Record<string, unknown> = {
    task_id:          typeof body.task_id   === 'string' ? body.task_id.trim()   : null,
    client_id:        typeof body.client_id === 'string' ? body.client_id.trim() : null,
    user_id:          auth.profile.id,
    description:      typeof body.description === 'string' ? body.description.trim() : null,
    started_at:       startedAt,
    ended_at:         typeof body.ended_at === 'string' ? body.ended_at : null,
    duration_seconds: durationSeconds,
    is_running:       isRunning,
    billable:         body.billable === true,
  };

  const { data, error } = await db
    .from('time_entries')
    .insert(payload)
    .select('*, task:tasks(id, title), client:clients(id, name)')
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, entry: data }, { status: 201 });
}
