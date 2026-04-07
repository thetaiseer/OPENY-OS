/**
 * POST /api/tasks
 *
 * Creates a new task record.
 *
 * Auth: requires 'admin', 'manager', or 'team' role.
 *
 * Request body (JSON):
 *   { title, description?, status?, priority?, start_date?, due_date?,
 *     client_id, assigned_to, created_by?, mentions?, tags? }
 *
 * Success response:
 *   { success: true, task: { ...createdTask } }
 *
 * Error response:
 *   { success: false, step: "validation" | "db_insert", error: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

const supabaseUrl            = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const VALID_STATUSES   = ['todo', 'in_progress', 'review', 'done', 'delivered', 'overdue'] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

export async function POST(request: NextRequest) {
  console.log('[POST /api/tasks] request received');

  // 1. Auth & role check
  const auth = await requireRole(request, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  console.log('[POST /api/tasks] caller:', auth.profile.email, '| role:', auth.profile.role);

  // 2. Parse request body
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn('[POST /api/tasks] body parse error:', err);
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  console.log('[POST /api/tasks] payload:', JSON.stringify(body));

  // 3. Validate required fields
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    console.warn('[POST /api/tasks] validation failed: title is empty');
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Task title is required' },
      { status: 400 },
    );
  }

  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : '';
  if (!clientId) {
    console.warn('[POST /api/tasks] validation failed: client_id is empty');
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Client is required' },
      { status: 400 },
    );
  }

  const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() : '';
  if (!assignedTo) {
    console.warn('[POST /api/tasks] validation failed: assigned_to is empty');
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Assigned team member is required' },
      { status: 400 },
    );
  }

  const dueDate = typeof body.due_date === 'string' ? body.due_date.trim() : '';
  if (!dueDate) {
    console.warn('[POST /api/tasks] validation failed: due_date is empty');
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Due date is required' },
      { status: 400 },
    );
  }

  // 4. Build insert payload (only allow known fields)
  const rawStatus   = typeof body.status   === 'string' ? body.status   : 'todo';
  const rawPriority = typeof body.priority === 'string' ? body.priority : 'medium';

  const status   = (VALID_STATUSES   as readonly string[]).includes(rawStatus)   ? rawStatus   : 'todo';
  const priority = (VALID_PRIORITIES as readonly string[]).includes(rawPriority) ? rawPriority : 'medium';

  const insertPayload: Record<string, unknown> = {
    title,
    status,
    priority,
    client_id:   clientId,
    assigned_to: assignedTo,
    due_date:    dueDate,
  };

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description) insertPayload.description = description;

  const startDate = typeof body.start_date === 'string' ? body.start_date.trim() : '';
  if (startDate) insertPayload.start_date = startDate;

  const createdBy = typeof body.created_by === 'string' ? body.created_by.trim() : '';
  if (createdBy) insertPayload.created_by = createdBy;

  if (Array.isArray(body.mentions)) {
    insertPayload.mentions = (body.mentions as unknown[]).filter(m => typeof m === 'string');
  }

  if (Array.isArray(body.tags)) {
    insertPayload.tags = (body.tags as unknown[]).filter(t => typeof t === 'string');
  }

  // 5. DB insert (service-role bypasses RLS — role already verified above)
  if (!supabaseServiceRoleKey) {
    console.error('[POST /api/tasks] SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json(
      { success: false, step: 'db_insert', error: 'Server configuration error' },
      { status: 500 },
    );
  }

  console.log('[POST /api/tasks] db insert payload:', JSON.stringify(insertPayload));

  const db = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { data, error } = await db
    .from('tasks')
    .insert(insertPayload)
    .select('*, client:clients(id,name)')
    .single();

  if (error) {
    console.error('[POST /api/tasks] db_insert error — code:', error.code, '| message:', error.message);
    return NextResponse.json(
      { success: false, step: 'db_insert', error: error.message },
      { status: 500 },
    );
  }

  console.log('[POST /api/tasks] insert success — id:', data?.id);

  // Activity log (fire-and-forget — never blocks response)
  void Promise.resolve(db.from('activities').insert({
    type:        'task',
    description: `Task "${title}" created`,
    client_id:   clientId,
  })).then(({ error: actErr }) => {
    if (actErr) console.warn('[POST /api/tasks] activity log failed:', actErr.message);
  }).catch((err: unknown) => {
    console.warn('[POST /api/tasks] activity log network error:', err instanceof Error ? err.message : String(err));
  });

  return NextResponse.json({ success: true, task: data }, { status: 201 });
}
