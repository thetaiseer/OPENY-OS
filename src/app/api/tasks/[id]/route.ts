/**
 * PATCH /api/tasks/[id]  — Update a task (title, status, priority, dates, etc.)
 * DELETE /api/tasks/[id] — Hard-delete a task.
 *
 * Auth: requires 'admin', 'manager', or 'team_member' role.
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
import { TASK_WITH_CLIENT } from '@/lib/supabase-list-columns';
import { notifyTaskCompleted } from '@/lib/notification-service';
import type { Task } from '@/lib/types';
import { processEvent } from '@/lib/event-engine';

const VALID_STATUSES = [
  'todo',
  'in_progress',
  'in_review',
  'review',
  'waiting_client',
  'approved',
  'scheduled',
  'published',
  'done',
  'completed',
  'delivered',
  'overdue',
  'cancelled',
] as const;
const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

const VALID_TASK_CATEGORIES = [
  'internal_task',
  'content_creation',
  'design_task',
  'publishing_task',
  'asset_upload_task',
  'follow_up_task',
] as const;

const VALID_CONTENT_PURPOSES = [
  'awareness',
  'engagement',
  'promotion',
  'branding',
  'lead_generation',
  'announcement',
  'offer_campaign',
] as const;

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

interface Params {
  id: string;
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;

  // Auth
  const auth = await requireRole(request, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

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
  if (
    typeof body.status === 'string' &&
    (VALID_STATUSES as readonly string[]).includes(body.status)
  ) {
    updatePayload.status = body.status;
  }
  if (
    typeof body.priority === 'string' &&
    (VALID_PRIORITIES as readonly string[]).includes(body.priority)
  ) {
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
    updatePayload.task_category = (VALID_TASK_CATEGORIES as readonly string[]).includes(cat)
      ? cat
      : null;
  }
  if (typeof body.content_purpose === 'string') {
    const cp = body.content_purpose.trim();
    updatePayload.content_purpose = (VALID_CONTENT_PURPOSES as readonly string[]).includes(cp)
      ? cp
      : null;
  }
  if (typeof body.caption === 'string') {
    updatePayload.caption = body.caption.trim() || null;
  }
  if (typeof body.client_name === 'string') {
    updatePayload.client_name = body.client_name.trim() || null;
  }
  if (Array.isArray(body.platforms)) {
    updatePayload.platforms = (body.platforms as unknown[]).filter(
      (p): p is string =>
        typeof p === 'string' && (VALID_PLATFORMS as readonly string[]).includes(p),
    );
  }
  if (Array.isArray(body.post_types)) {
    updatePayload.post_types = (body.post_types as unknown[]).filter(
      (pt): pt is string =>
        typeof pt === 'string' && (VALID_POST_TYPES as readonly string[]).includes(pt),
    );
  }
  if (typeof body.publishing_schedule_id === 'string') {
    updatePayload.publishing_schedule_id = body.publishing_schedule_id.trim() || null;
  }
  if (typeof body.asset_id === 'string') {
    updatePayload.asset_id = body.asset_id.trim() || null;
  }
  if (Array.isArray(body.mentions)) {
    updatePayload.mentions = (body.mentions as unknown[]).filter((m) => typeof m === 'string');
  }
  if (Array.isArray(body.tags)) {
    updatePayload.tags = (body.tags as unknown[]).filter((t) => typeof t === 'string');
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
  if (typeof body.project_id === 'string') {
    updatePayload.project_id = body.project_id.trim() || null;
  }
  if (typeof body.position === 'number' && Number.isFinite(body.position)) {
    updatePayload.position = Math.max(0, Math.trunc(body.position));
  }

  const db = getServiceClient();
  const { data: existingTask } = await db
    .from('tasks')
    .select('status, title, created_by_id, client_id')
    .eq('id', id)
    .maybeSingle();

  const wasCompleted = ['done', 'completed'].includes(
    String(existingTask?.status ?? '').toLowerCase(),
  );
  const { data, error } = await db
    .from('tasks')
    .update(updatePayload)
    .eq('id', id)
    .select(TASK_WITH_CLIENT)
    .single();

  if (error) {
    console.error(
      '[PATCH /api/tasks/[id]] db_update error — code:',
      error.code,
      '| message:',
      error.message,
    );
    return NextResponse.json(
      { success: false, step: 'db_update', error: error.message },
      { status: 500 },
    );
  }

  const task = data as unknown as Task;
  void processEvent({
    event_type: 'task.updated',
    actor_id: auth.profile.id,
    entity_type: 'task',
    entity_id: task.id,
    client_id: (task.client_id ?? existingTask?.client_id ?? null) as string | null,
    payload: {
      taskTitle: task.title ?? existingTask?.title ?? 'Task',
      status: task.status ?? null,
    },
  });

  const isCompleted = ['done', 'completed'].includes(String(task.status ?? '').toLowerCase());
  if (task.id && isCompleted && !wasCompleted) {
    void notifyTaskCompleted({
      taskId: task.id,
      taskTitle: task.title ?? existingTask?.title ?? 'Task',
      ownerId: task.created_by_id ?? existingTask?.created_by_id ?? null,
      actorId: auth.profile.id,
      clientId: task.client_id ?? existingTask?.client_id ?? null,
    });
  }

  return NextResponse.json({ success: true, task });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: { params: Promise<Params> }) {
  const { id } = await params;

  // Auth
  const auth = await requireRole(request, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  if (!id) {
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Task ID is required' },
      { status: 400 },
    );
  }

  const db = getServiceClient();
  const { error } = await db.from('tasks').delete().eq('id', id);

  if (error) {
    console.error(
      '[DELETE /api/tasks/[id]] db_delete error — code:',
      error.code,
      '| message:',
      error.message,
    );
    return NextResponse.json(
      { success: false, step: 'db_delete', error: error.message },
      { status: 500 },
    );
  }

  // Activity log (fire-and-forget)
  void Promise.resolve(
    db.from('activities').insert({
      type: 'task',
      description: `Task deleted (id: ${id})`,
    }),
  )
    .then(({ error: actErr }) => {
      if (actErr) console.warn('[DELETE /api/tasks/[id]] activity log failed:', actErr.message);
    })
    .catch((err: unknown) => {
      console.warn(
        '[DELETE /api/tasks/[id]] activity log network error:',
        err instanceof Error ? err.message : String(err),
      );
    });

  return NextResponse.json({ success: true });
}
