/**
 * PATCH /api/tasks/[id]  — Update a task (title, status, priority, dates, etc.)
 * DELETE /api/tasks/[id] — Hard-delete a task.
 *
 * Auth: requires 'admin', 'manager', or 'team' role.
 *
 * PATCH request body (JSON):
 *   Partial task fields — only supplied fields are updated.
 *   All unknown keys are ignored.
 *
 * PATCH success response:
 *   { success: true, task: { ...updatedTask } }
 *
 * DELETE success response:
 *   { success: true }
 *
 * Error response:
 *   { success: false, step: "validation" | "db_update" | "db_delete", error: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_STATUSES   = ['todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

interface Params { id: string }

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  console.log('[PATCH /api/tasks/[id]] request received — id:', id);

  // Auth
  const auth = await requireRole(request, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  console.log('[PATCH /api/tasks/[id]] caller:', auth.profile.email, '| role:', auth.profile.role);

  if (!id) {
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Task ID is required' },
      { status: 400 },
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn('[PATCH /api/tasks/[id]] body parse error:', err);
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  console.log('[PATCH /api/tasks/[id]] payload:', JSON.stringify(body));

  // Build update payload — only known fields
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.title === 'string' && body.title.trim()) {
    updatePayload.title = body.title.trim();
  }
  if (typeof body.description === 'string') {
    updatePayload.description = body.description.trim() || null;
  }
  if (typeof body.status === 'string' && (VALID_STATUSES as readonly string[]).includes(body.status)) {
    updatePayload.status = body.status;
  }
  if (typeof body.priority === 'string' && (VALID_PRIORITIES as readonly string[]).includes(body.priority)) {
    updatePayload.priority = body.priority;
  }
  if (typeof body.due_date === 'string') {
    updatePayload.due_date = body.due_date.trim() || null;
  }
  if (typeof body.start_date === 'string') {
    updatePayload.start_date = body.start_date.trim() || null;
  }
  if (typeof body.client_id === 'string') {
    updatePayload.client_id = body.client_id.trim() || null;
  }
  if (typeof body.assigned_to === 'string') {
    updatePayload.assigned_to = body.assigned_to.trim() || null;
  }
  if (typeof body.created_by === 'string') {
    updatePayload.created_by = body.created_by.trim() || null;
  }
  if (Array.isArray(body.mentions)) {
    updatePayload.mentions = (body.mentions as unknown[]).filter(m => typeof m === 'string');
  }
  if (Array.isArray(body.tags)) {
    updatePayload.tags = (body.tags as unknown[]).filter(t => typeof t === 'string');
  }

  if (!supabaseServiceRoleKey) {
    console.error('[PATCH /api/tasks/[id]] SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json(
      { success: false, step: 'db_update', error: 'Server configuration error' },
      { status: 500 },
    );
  }

  const db = createClient(supabaseUrl, supabaseServiceRoleKey!);
  const { data, error } = await db
    .from('tasks')
    .update(updatePayload)
    .eq('id', id)
    .select('*, client:clients(id,name)')
    .single();

  if (error) {
    console.error('[PATCH /api/tasks/[id]] db_update error — code:', error.code, '| message:', error.message);
    return NextResponse.json(
      { success: false, step: 'db_update', error: error.message },
      { status: 500 },
    );
  }

  console.log('[PATCH /api/tasks/[id]] update success — id:', data?.id);

  return NextResponse.json({ success: true, task: data });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  console.log('[DELETE /api/tasks/[id]] request received — id:', id);

  // Auth
  const auth = await requireRole(request, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  console.log('[DELETE /api/tasks/[id]] caller:', auth.profile.email, '| role:', auth.profile.role);

  if (!id) {
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Task ID is required' },
      { status: 400 },
    );
  }

  if (!supabaseServiceRoleKey) {
    console.error('[DELETE /api/tasks/[id]] SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json(
      { success: false, step: 'db_delete', error: 'Server configuration error' },
      { status: 500 },
    );
  }

  const db = createClient(supabaseUrl, supabaseServiceRoleKey!);
  const { error } = await db.from('tasks').delete().eq('id', id);

  if (error) {
    console.error('[DELETE /api/tasks/[id]] db_delete error — code:', error.code, '| message:', error.message);
    return NextResponse.json(
      { success: false, step: 'db_delete', error: error.message },
      { status: 500 },
    );
  }

  console.log('[DELETE /api/tasks/[id]] delete success — id:', id);

  // Activity log (fire-and-forget)
  void Promise.resolve(db.from('activities').insert({
    type:        'task',
    description: `Task deleted (id: ${id})`,
  })).then(({ error: actErr }) => {
    if (actErr) console.warn('[DELETE /api/tasks/[id]] activity log failed:', actErr.message);
  }).catch((err: unknown) => {
    console.warn('[DELETE /api/tasks/[id]] activity log network error:', err instanceof Error ? err.message : String(err));
  });

  return NextResponse.json({ success: true });
}
