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
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';


const VALID_STATUSES = [
  'todo', 'in_progress', 'in_review', 'review', 'waiting_client',
  'approved', 'scheduled', 'published', 'done', 'completed',
  'delivered', 'overdue', 'cancelled',
] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

const VALID_TASK_CATEGORIES = [
  'internal_task', 'content_creation', 'design_task', 'approval_task',
  'publishing_task', 'asset_upload_task', 'follow_up_task',
] as const;

const VALID_CONTENT_PURPOSES = [
  'awareness', 'engagement', 'promotion', 'branding',
  'lead_generation', 'announcement', 'offer_campaign',
] as const;

const VALID_PLATFORMS = [
  'instagram', 'facebook', 'tiktok', 'linkedin',
  'twitter', 'snapchat', 'youtube_shorts',
] as const;

const VALID_POST_TYPES = ['post', 'reel', 'carousel', 'story'] as const;

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
  if (typeof body.due_time === 'string') {
    updatePayload.due_time = body.due_time.trim() || null;
  }
  if (typeof body.timezone === 'string' && body.timezone.trim()) {
    updatePayload.timezone = body.timezone.trim();
  }
  if (typeof body.task_category === 'string') {
    const cat = body.task_category.trim();
    updatePayload.task_category = (VALID_TASK_CATEGORIES as readonly string[]).includes(cat) ? cat : null;
  }
  if (typeof body.content_purpose === 'string') {
    const cp = body.content_purpose.trim();
    updatePayload.content_purpose = (VALID_CONTENT_PURPOSES as readonly string[]).includes(cp) ? cp : null;
  }
  if (typeof body.caption === 'string') {
    updatePayload.caption = body.caption.trim() || null;
  }
  if (typeof body.client_name === 'string') {
    updatePayload.client_name = body.client_name.trim() || null;
  }
  if (Array.isArray(body.platforms)) {
    updatePayload.platforms = (body.platforms as unknown[]).filter(
      (p): p is string => typeof p === 'string' && (VALID_PLATFORMS as readonly string[]).includes(p),
    );
  }
  if (Array.isArray(body.post_types)) {
    updatePayload.post_types = (body.post_types as unknown[]).filter(
      (pt): pt is string => typeof pt === 'string' && (VALID_POST_TYPES as readonly string[]).includes(pt),
    );
  }
  if (typeof body.publishing_schedule_id === 'string') {
    updatePayload.publishing_schedule_id = body.publishing_schedule_id.trim() || null;
  }
  if (typeof body.asset_id === 'string') {
    updatePayload.asset_id = body.asset_id.trim() || null;
  }
  if (Array.isArray(body.mentions)) {
    updatePayload.mentions = (body.mentions as unknown[]).filter(m => typeof m === 'string');
  }
  if (Array.isArray(body.tags)) {
    updatePayload.tags = (body.tags as unknown[]).filter(t => typeof t === 'string');
  }
  // v2 fields
  if (typeof body.notes === 'string') {
    updatePayload.notes = body.notes.trim() || null;
  }
  if (typeof body.assignee_id === 'string') {
    updatePayload.assignee_id = body.assignee_id.trim() || null;
  }
  if (typeof body.created_by_id === 'string') {
    updatePayload.created_by_id = body.created_by_id.trim() || null;
  }
  if (typeof body.content_item_id === 'string') {
    updatePayload.content_item_id = body.content_item_id.trim() || null;
  }
  if (typeof body.approval_id === 'string') {
    updatePayload.approval_id = body.approval_id.trim() || null;
  }

  const db = getServiceClient();
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

  const db = getServiceClient();
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
