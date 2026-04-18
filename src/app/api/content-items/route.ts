/**
 * GET /api/content-items
 *   List content items. Query params: client_id, status, platform
 *
 * POST /api/content-items
 *   Create a content item.
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';


const VALID_STATUSES = ['draft', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'] as const;
const CONTENT_TASK_PREFIX = 'Content: ';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const status   = searchParams.get('status');
  const platform = searchParams.get('platform');

  try {
    const db = getServiceClient();
    let query = db
      .from('content_items')
      .select(`
        *,
        client:clients(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (clientId) query = query.eq('client_id', clientId);
    if (status)   query = query.eq('status', status);
    if (platform) query = (query as unknown as { contains: (col: string, val: string[]) => typeof query }).contains('platform_targets', [platform]);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/content-items] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const title   = typeof body.title   === 'string' ? body.title.trim()   : '';
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : null;
  const rawStatus = typeof body.status === 'string' ? body.status : 'draft';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'draft';

  if (!title) {
    return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
  }

  const scheduleDate = typeof body.schedule_date === 'string' ? body.schedule_date.trim() : null;
  const shouldCreateTask = body.create_task === true;
  const taskDueDate = typeof body.task_due_date === 'string' && body.task_due_date.trim()
    ? body.task_due_date.trim()
    : (scheduleDate || new Date().toISOString().slice(0, 10));
  const taskAssigneeId = typeof body.task_assignee_id === 'string' && body.task_assignee_id.trim()
    ? body.task_assignee_id.trim()
    : null;

  const payload: Record<string, unknown> = {
    title,
    status,
    client_id:       clientId || null,
    description:     typeof body.description      === 'string' ? body.description.trim()     : null,
    caption:         typeof body.caption          === 'string' ? body.caption.trim()         : null,
    platform_targets: Array.isArray(body.platform_targets) ? body.platform_targets           : [],
    post_types:      Array.isArray(body.post_types)        ? body.post_types                 : [],
    purpose:         typeof body.purpose          === 'string' ? body.purpose                : null,
    created_by:      auth.profile.id,
    ...(scheduleDate ? { schedule_date: scheduleDate } : {}),
  };

  try {
    const db = getServiceClient();
    const { data, error } = await db
      .from('content_items')
      .insert(payload)
      .select('*, client:clients(id, name)')
      .single();

    if (error) {
      console.error('[POST /api/content-items] db error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Optionally create linked task (best-effort)
    if (data?.id && shouldCreateTask) {
      const linkedTaskTitle = `${CONTENT_TASK_PREFIX}${title}`;
      const { data: createdTask, error: taskError } = await db
        .from('tasks')
        .insert({
          title: linkedTaskTitle,
          description: typeof body.description === 'string' ? body.description.trim() || null : null,
          status: 'todo',
          priority: 'medium',
          due_date: taskDueDate,
          client_id: clientId || null,
          assigned_to: taskAssigneeId,
          assignee_id: taskAssigneeId,
          created_by_id: auth.profile.id,
          task_category: 'content_creation',
          content_item_id: data.id,
          caption: typeof body.caption === 'string' ? body.caption.trim() || null : null,
        })
        .select('id')
        .single();

      if (taskError) {
        console.warn('[POST /api/content-items] linked task auto-create failed:', taskError.message);
      } else if (createdTask?.id) {
        const linkedTaskId = createdTask.id as string;
        void db.from('content_items').update({ task_id: linkedTaskId }).eq('id', data.id).then(({ error: backlinkErr }) => {
          if (backlinkErr) console.warn('[POST /api/content-items] task_id backlink update failed for content:', data.id, 'task:', linkedTaskId, 'error:', backlinkErr.message);
        });
        void db.from('entity_links').upsert({
          source_type: 'content',
          source_id: data.id,
          target_type: 'task',
          target_id: linkedTaskId,
          link_type: 'related',
          created_by: auth.profile.id,
        }, { onConflict: 'source_type,source_id,target_type,target_id' }).then(({ error: linkErr }) => {
          if (linkErr) console.warn('[POST /api/content-items] entity_links upsert failed for content:', data.id, 'task:', linkedTaskId, 'error:', linkErr.message);
        });
      }
    }

    // Activity log (best-effort)
    void db.from('activities').insert({
      type:        'content_item_created',
      description: `Content item "${title}" created`,
      user_id:     auth.profile.id,
      user_uuid:   auth.profile.id,
      client_id:   clientId || null,
      entity_type: 'content_item',
      entity_id:   data?.id ?? null,
    });

    // Auto-create calendar event when content has a schedule_date or scheduled status
    if (data?.id && (scheduleDate || status === 'scheduled')) {
      const calStartsAt = scheduleDate
        ? `${scheduleDate}T09:00:00`
        : `${new Date().toISOString().slice(0, 10)}T09:00:00`;
      void db.from('calendar_events').insert({
        title:      `Content: ${title}`,
        event_type: 'publishing',
        starts_at:  calStartsAt,
        client_id:  clientId || null,
        status:     'active',
        notes:      null,
      }).then(({ error: calErr }) => {
        if (calErr) console.warn('[POST /api/content-items] calendar event auto-create failed:', calErr.message);
      });
    }

    const { data: refreshedItem } = data?.id
      ? await db.from('content_items').select('*, client:clients(id, name)').eq('id', data.id).single()
      : { data: data };

    return NextResponse.json({ success: true, item: refreshedItem ?? data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
