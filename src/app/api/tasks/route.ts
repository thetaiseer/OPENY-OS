/**
 * POST /api/tasks
 *
 * Creates a new task record.
 *
 * Auth: requires 'admin', 'manager', or 'team_member' role.
 *
 * Request body (JSON):
 *   { title, description?, status?, priority?, start_date?, due_date?,
 *     due_time?, timezone?, task_category?, content_purpose?, caption?,
 *     notes?, client_id?, client_name?, assigned_to?, assignee_id?,
 *     created_by?, created_by_id?, mentions?, tags?,
 *     platforms?, post_types?, publishing_schedule_id?,
 *     asset_id?, asset_ids?, content_item_id? }
 *
 * client_id and assigned_to are required unless task_category is 'internal_task'.
 * asset_ids: array of asset UUIDs — creates task_asset_links entries.
 *
 * Success response:
 *   { success: true, task: { ...createdTask } }
 *
 * Error response:
 *   { success: false, step: "validation" | "db_insert", error: "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { notifyTaskCreated } from '@/lib/notification-service';
import { sendEmail, taskAssignedEmail, logEmailSent } from '@/lib/email';


const VALID_STATUSES = [
  'todo', 'in_progress', 'in_review', 'review', 'waiting_client',
  'approved', 'scheduled', 'published', 'done', 'completed',
  'delivered', 'overdue', 'cancelled',
] as const;

const VALID_PRIORITIES = ['low', 'medium', 'high'] as const;

const VALID_TASK_CATEGORIES = [
  'internal_task', 'content_creation', 'design_task',
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

export async function POST(request: NextRequest) {
  console.log('[POST /api/tasks] request received');

  // 1. Auth & role check
  const auth = await requireRole(request, ['admin', 'manager', 'team_member']);
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
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Task title is required' },
      { status: 400 },
    );
  }

  const taskCategory = typeof body.task_category === 'string' ? body.task_category.trim() : '';
  const isInternalTask = taskCategory === 'internal_task';

  // client_id and assigned_to are required for non-internal tasks
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : '';
  if (!clientId && !isInternalTask) {
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Client is required' },
      { status: 400 },
    );
  }

  const assignedTo = typeof body.assigned_to === 'string' ? body.assigned_to.trim() : '';
  if (!assignedTo && !isInternalTask) {
    return NextResponse.json(
      { success: false, step: 'validation', error: 'Assigned team member is required' },
      { status: 400 },
    );
  }

  const dueDate = typeof body.due_date === 'string' ? body.due_date.trim() : '';
  if (!dueDate) {
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
    due_date: dueDate,
  };

  if (clientId)   insertPayload.client_id   = clientId;
  if (assignedTo) insertPayload.assigned_to = assignedTo;

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description) insertPayload.description = description;

  const startDate = typeof body.start_date === 'string' ? body.start_date.trim() : '';
  if (startDate) insertPayload.start_date = startDate;

  const dueTime = typeof body.due_time === 'string' ? body.due_time.trim() : '';
  if (dueTime) insertPayload.due_time = dueTime;

  const timezone = typeof body.timezone === 'string' ? body.timezone.trim() : '';
  if (timezone) insertPayload.timezone = timezone;

  if (taskCategory && (VALID_TASK_CATEGORIES as readonly string[]).includes(taskCategory)) {
    insertPayload.task_category = taskCategory;
  }

  const clientName = typeof body.client_name === 'string' ? body.client_name.trim() : '';
  if (clientName) insertPayload.client_name = clientName;

  const contentPurpose = typeof body.content_purpose === 'string' ? body.content_purpose.trim() : '';
  if (contentPurpose && (VALID_CONTENT_PURPOSES as readonly string[]).includes(contentPurpose)) {
    insertPayload.content_purpose = contentPurpose;
  }

  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  if (caption) insertPayload.caption = caption;

  const createdBy = typeof body.created_by === 'string' ? body.created_by.trim() : '';
  if (createdBy) insertPayload.created_by = createdBy;

  if (Array.isArray(body.mentions)) {
    insertPayload.mentions = (body.mentions as unknown[]).filter(m => typeof m === 'string');
  }

  if (Array.isArray(body.tags)) {
    insertPayload.tags = (body.tags as unknown[]).filter(t => typeof t === 'string');
  }

  if (Array.isArray(body.platforms)) {
    insertPayload.platforms = (body.platforms as unknown[]).filter(
      (p): p is string => typeof p === 'string' && (VALID_PLATFORMS as readonly string[]).includes(p),
    );
  }

  if (Array.isArray(body.post_types)) {
    insertPayload.post_types = (body.post_types as unknown[]).filter(
      (pt): pt is string => typeof pt === 'string' && (VALID_POST_TYPES as readonly string[]).includes(pt),
    );
  }

  const publishingScheduleId = typeof body.publishing_schedule_id === 'string' ? body.publishing_schedule_id.trim() : '';
  if (publishingScheduleId) insertPayload.publishing_schedule_id = publishingScheduleId;

  const assetId = typeof body.asset_id === 'string' ? body.asset_id.trim() : '';
  if (assetId) insertPayload.asset_id = assetId;

  // New v2 fields
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (notes) insertPayload.notes = notes;

  const assigneeId = typeof body.assignee_id === 'string' ? body.assignee_id.trim() : '';
  if (assigneeId) insertPayload.assignee_id = assigneeId;

  const createdById = typeof body.created_by_id === 'string' ? body.created_by_id.trim() : '';
  if (createdById) insertPayload.created_by_id = createdById;

  // Fall back to caller's profile UUID for created_by_id if not provided
  if (!createdById && auth.profile.id) insertPayload.created_by_id = auth.profile.id;

  const contentItemId = typeof body.content_item_id === 'string' ? body.content_item_id.trim() : '';
  if (contentItemId) insertPayload.content_item_id = contentItemId;

  // Collect asset_ids array for task_asset_links
  const assetIds: string[] = [];
  if (Array.isArray(body.asset_ids)) {
    for (const id of body.asset_ids) {
      if (typeof id === 'string' && id.trim()) assetIds.push(id.trim());
    }
  }
  // Also include single asset_id if not already in the array
  if (assetId && !assetIds.includes(assetId)) assetIds.push(assetId);

  // 5. DB insert (service-role bypasses RLS — role already verified above)
  console.log('[POST /api/tasks] db insert payload:', JSON.stringify(insertPayload));

  const db = getServiceClient();
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

  // If an asset was provided, link the asset back to this task (fire-and-forget)
  if (assetId && data?.id) {
    void db.from('assets').update({ task_id: data.id }).eq('id', assetId)
      .then(({ error: aErr }) => {
        if (aErr) console.warn('[POST /api/tasks] asset link failed:', aErr.message);
      });
  }

  // Insert task_asset_links for all provided asset IDs
  if (assetIds.length > 0 && data?.id) {
    const linkRows = assetIds.map(aid => ({
      task_id:   data.id,
      asset_id:  aid,
      linked_by: auth.profile.id ?? null,
    }));
    void db.from('task_asset_links')
      .upsert(linkRows, { onConflict: 'task_id,asset_id' })
      .then(({ error: linkErr }) => {
        if (linkErr) console.warn('[POST /api/tasks] task_asset_links insert failed:', linkErr.message);
      });
    // Also update assets.status → 'linked' and assets.task_id (best-effort)
    void db.from('assets')
      .update({ task_id: data.id, status: 'linked' })
      .in('id', assetIds)
      .then(({ error: aErr }) => {
        if (aErr) console.warn('[POST /api/tasks] asset status update failed:', aErr.message);
      });
  }

  // Activity log (fire-and-forget — never blocks response)
  void Promise.resolve(db.from('activities').insert({
    type:        'task',
    description: `Task "${title}" created`,
    client_id:   clientId || null,
    entity_type: 'task',
    entity_id:   data?.id ?? null,
    user_uuid:   auth.profile.id ?? null,
  })).then(({ error: actErr }) => {
    if (actErr) console.warn('[POST /api/tasks] activity log failed:', actErr.message);
  }).catch((err: unknown) => {
    console.warn('[POST /api/tasks] activity log network error:', err instanceof Error ? err.message : String(err));
  });

  // Auto-create publishing schedule for publishing_task category
  if (taskCategory === 'publishing_task' && data?.id && dueDate) {
    void (async () => {
      try {
        const schedPayload: Record<string, unknown> = {
          asset_id:       assetId || null,
          client_id:      clientId || null,
          client_name:    data.client_name || clientName || null,
          scheduled_date: dueDate,
          scheduled_time: dueTime || '09:00:00',
          timezone:       insertPayload.timezone || 'UTC',
          platforms:      insertPayload.platforms || [],
          post_types:     insertPayload.post_types || [],
          caption:        caption || null,
          status:         'scheduled',
          task_id:        data.id,
          created_by:     createdBy || null,
        };
        const { data: sched, error: schedErr } = await db
          .from('publishing_schedules')
          .insert(schedPayload)
          .select()
          .single();
        if (schedErr) {
          console.warn('[POST /api/tasks] publishing schedule auto-create failed:', schedErr.message);
        } else if (sched?.id) {
          await db.from('tasks').update({ publishing_schedule_id: sched.id }).eq('id', data.id);
          console.log('[POST /api/tasks] publishing schedule auto-created:', sched.id);
        }
      } catch (e) {
        console.warn('[POST /api/tasks] publishing schedule error:', e instanceof Error ? e.message : String(e));
      }
    })();
  }

  // Fire notifications (side effect — never blocks)
  if (data?.id) {
    void notifyTaskCreated({
      taskId:       data.id,
      taskTitle:    title,
      clientId:     clientId || null,
      assignedToId: assignedTo || null,
      createdById:  createdBy || null,
      clientName:   data.client_name || clientName || null,
    });
  }

  if (assignedTo && data?.id) {
    void (async () => {
      let assigneeEmail = '';
      try {
        const { data: member } = await db
          .from('team_members')
          .select('email, full_name')
          .eq('profile_id', assignedTo)
          .maybeSingle();
        if (member?.email) {
          assigneeEmail = member.email;
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
          await sendEmail({
            to: member.email,
            subject: `New Task: ${title}`,
            html: taskAssignedEmail({
              recipientName: member.full_name ?? member.email,
              taskTitle:     title,
              clientName:    data.client_name || clientName || undefined,
              dueDate:       dueDate || undefined,
              appUrl,
            }),
          });
          void logEmailSent({ to: assigneeEmail, subject: `New Task: ${title}`, eventType: 'task_assigned', entityType: 'task', entityId: data.id });
        }
      } catch (emailErr) {
        console.warn('[POST /api/tasks] email failed:', emailErr instanceof Error ? emailErr.message : String(emailErr));
        // Only log failed email if we have a valid email address to log against
        if (assigneeEmail) {
          void logEmailSent({ to: assigneeEmail, subject: `New Task: ${title}`, status: 'failed', error: String(emailErr), eventType: 'task_assigned', entityType: 'task', entityId: data?.id });
        }
      }
    })();
  }

  return NextResponse.json({ success: true, task: data }, { status: 201 });
}
