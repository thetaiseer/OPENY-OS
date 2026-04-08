/**
 * GET /api/publishing-schedules
 *   List publishing schedules. Supports:
 *     ?asset_id=<uuid>   — filter by asset
 *     ?client_id=<uuid>  — filter by client
 *     ?status=<string>   — filter by status
 *     ?date_from=<date>  — scheduled_date >= date_from
 *     ?date_to=<date>    — scheduled_date <= date_to
 *     ?platform=<string> — filter where platforms contains value
 *     ?post_type=<string>— filter where post_types contains value
 *
 * POST /api/publishing-schedules
 *   Create a new publishing schedule and auto-create a linked task.
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireRole } from '@/lib/api-auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

const VALID_PLATFORMS = [
  'instagram', 'facebook', 'tiktok', 'linkedin',
  'twitter', 'snapchat', 'youtube_shorts',
] as const;

const VALID_POST_TYPES = ['post', 'reel', 'carousel', 'story'] as const;

const VALID_STATUSES = [
  'draft', 'scheduled', 'pending_review', 'approved',
  'published', 'missed', 'cancelled',
] as const;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const assetId   = searchParams.get('asset_id');
  const clientId  = searchParams.get('client_id');
  const status    = searchParams.get('status');
  const dateFrom  = searchParams.get('date_from');
  const dateTo    = searchParams.get('date_to');
  const platform  = searchParams.get('platform');
  const postType  = searchParams.get('post_type');

  try {
    const db = getSupabase();

    let query = db
      .from('publishing_schedules')
      .select(`
        *,
        asset:assets(id, name, content_type, file_url, preview_url, client_name)
      `)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true });

    if (assetId)  query = query.eq('asset_id', assetId);
    if (clientId) query = query.eq('client_id', clientId);
    if (status)   query = query.eq('status', status);
    if (dateFrom) query = query.gte('scheduled_date', dateFrom);
    if (dateTo)   query = query.lte('scheduled_date', dateTo);
    if (platform) query = query.contains('platforms', [platform]);
    if (postType) query = query.contains('post_types', [postType]);

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/publishing-schedules] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, schedules: data ?? [] });
  } catch (err) {
    console.error('[GET /api/publishing-schedules] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Validate required fields ──────────────────────────────────────────────
  const assetId = typeof body.asset_id === 'string' ? body.asset_id.trim() : '';
  if (!assetId) {
    return NextResponse.json({ success: false, error: 'asset_id is required' }, { status: 400 });
  }

  const scheduledDate = typeof body.scheduled_date === 'string' ? body.scheduled_date.trim() : '';
  if (!scheduledDate) {
    return NextResponse.json({ success: false, error: 'scheduled_date is required' }, { status: 400 });
  }

  const rawPlatforms = Array.isArray(body.platforms) ? body.platforms : [];
  const platforms = rawPlatforms.filter(
    (p): p is string => typeof p === 'string' && (VALID_PLATFORMS as readonly string[]).includes(p),
  );
  if (platforms.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one platform is required' }, { status: 400 });
  }

  const rawPostTypes = Array.isArray(body.post_types) ? body.post_types : [];
  const postTypes = rawPostTypes.filter(
    (pt): pt is string => typeof pt === 'string' && (VALID_POST_TYPES as readonly string[]).includes(pt),
  );
  if (postTypes.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one post type is required' }, { status: 400 });
  }

  // ── Optional fields ───────────────────────────────────────────────────────
  const scheduledTime   = typeof body.scheduled_time === 'string' ? body.scheduled_time : '09:00:00';
  const timezone        = typeof body.timezone === 'string' ? body.timezone : 'UTC';
  const clientId        = typeof body.client_id === 'string' ? body.client_id || null : null;
  const clientName      = typeof body.client_name === 'string' ? body.client_name || null : null;
  const caption         = typeof body.caption === 'string' ? body.caption || null : null;
  const notes           = typeof body.notes === 'string' ? body.notes || null : null;
  const assignedTo      = typeof body.assigned_to === 'string' ? body.assigned_to || null : null;
  const assigneeName    = typeof body.assignee_name === 'string' ? body.assignee_name || null : null;
  const reminderMinutes = typeof body.reminder_minutes === 'number' ? body.reminder_minutes : null;
  const rawStatus       = typeof body.status === 'string' ? body.status : 'scheduled';
  const status          = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'scheduled';
  const createTask      = body.create_task !== false; // default true

  try {
    const db = getSupabase();

    // ── Fetch asset info to build task title ─────────────────────────────────
    const { data: assetData, error: assetErr } = await db
      .from('assets')
      .select('id, name, client_id, client_name')
      .eq('id', assetId)
      .single();

    if (assetErr || !assetData) {
      return NextResponse.json(
        { success: false, error: 'Asset not found' },
        { status: 404 },
      );
    }

    const resolvedClientId   = clientId   ?? assetData.client_id   ?? null;
    const resolvedClientName = clientName ?? assetData.client_name ?? null;

    // ── Insert publishing schedule ────────────────────────────────────────────
    const schedulePayload: Record<string, unknown> = {
      asset_id:         assetId,
      client_id:        resolvedClientId,
      client_name:      resolvedClientName,
      scheduled_date:   scheduledDate,
      scheduled_time:   scheduledTime,
      timezone,
      platforms,
      post_types:       postTypes,
      caption,
      notes,
      status,
      assigned_to:      assignedTo,
      assignee_name:    assigneeName,
      reminder_minutes: reminderMinutes,
      created_by:       auth.profile.id,
      created_by_name:  auth.profile.name ?? auth.profile.email,
    };

    const { data: schedule, error: schedErr } = await db
      .from('publishing_schedules')
      .insert(schedulePayload)
      .select('*')
      .single();

    if (schedErr || !schedule) {
      console.error('[POST /api/publishing-schedules] insert error:', schedErr?.message);
      return NextResponse.json(
        { success: false, error: schedErr?.message ?? 'Failed to create schedule' },
        { status: 500 },
      );
    }

    let createdTask = null;

    // ── Auto-create linked task ───────────────────────────────────────────────
    if (createTask && resolvedClientId) {
      const platformLabels = platforms.map(p => {
        const labels: Record<string, string> = {
          instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
          linkedin: 'LinkedIn', twitter: 'X/Twitter', snapchat: 'Snapchat',
          youtube_shorts: 'YouTube Shorts',
        };
        return labels[p] ?? p;
      });
      const postTypeLabels = postTypes.map(pt => {
        const labels: Record<string, string> = {
          post: 'Post', reel: 'Reel', carousel: 'Carousel', story: 'Story',
        };
        return labels[pt] ?? pt;
      });

      const taskTitle = `Publish ${platformLabels.join(' + ')} ${postTypeLabels.join(' + ')} for ${resolvedClientName ?? 'Client'}`;

      const taskPayload: Record<string, unknown> = {
        title:                  taskTitle,
        description:            caption ? `Caption: ${caption}` : `Publishing schedule for "${assetData.name}"`,
        status:                 'todo',
        priority:               'medium',
        due_date:               scheduledDate,
        client_id:              resolvedClientId,
        assigned_to:            assignedTo ?? auth.profile.id,
        created_by:             auth.profile.id,
        publishing_schedule_id: schedule.id,
        asset_id:               assetId,
        platforms,
        post_types:             postTypes,
      };

      const { data: taskData, error: taskErr } = await db
        .from('tasks')
        .insert(taskPayload)
        .select('id, title')
        .single();

      if (taskErr) {
        // Task creation failure is non-fatal — log but continue
        console.warn('[POST /api/publishing-schedules] task creation failed:', taskErr.message);
      } else {
        createdTask = taskData;
        // Link task back to schedule
        await db
          .from('publishing_schedules')
          .update({ task_id: taskData.id })
          .eq('id', schedule.id);
        schedule.task_id = taskData.id;
      }
    }

    // ── Activity log (best-effort) ────────────────────────────────────────────
    void db.from('activities').insert({
      type:        'publishing_scheduled',
      description: `Publishing scheduled for "${assetData.name}" on ${scheduledDate}`,
      user_id:     auth.profile.id,
      client_id:   resolvedClientId,
    }).then(({ error: actErr }) => {
      if (actErr) console.warn('[publishing-schedules] activity log failed:', actErr.message);
    });

    return NextResponse.json(
      { success: true, schedule, task: createdTask },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/publishing-schedules] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
