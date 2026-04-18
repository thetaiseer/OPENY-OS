/**
 * GET  /api/notifications — list notifications for the current user
 * POST /api/notifications — create a notification (admin/manager only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';


export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const userId      = searchParams.get('user_id');
  const unreadOnly  = searchParams.get('unread') === 'true';
  const limit       = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const page        = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const q           = searchParams.get('q');
  const type        = searchParams.get('type');
  const category    = searchParams.get('category');
  const priority    = searchParams.get('priority');
  const eventType   = searchParams.get('event_type');
  const clientId    = searchParams.get('client_id');
  const dateFrom    = searchParams.get('date_from');
  const dateTo      = searchParams.get('date_to');

  try {
    const db = getServiceClient();
    let query = db
      .from('notifications')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, (page - 1) * limit + limit - 1);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    }
    if (unreadOnly) {
      query = query.eq('read', false);
    }
    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (priority) query = query.eq('priority', priority);
    if (eventType) query = query.eq('event_type', eventType);
    if (clientId) query = query.eq('client_id', clientId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);
    if (q) {
      const pattern = `%${q}%`;
      query = query.or(`title.ilike.${pattern},message.ilike.${pattern}`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('[GET /api/notifications] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    let unreadCount = 0;
    if (userId) {
      const { count: unread } = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},user_id.is.null`)
        .eq('read', false);
      unreadCount = unread ?? 0;
    } else {
      unreadCount = (data ?? []).filter((n: { read: boolean }) => !n.read).length;
    }

    return NextResponse.json({
      success: true,
      notifications: data ?? [],
      unreadCount,
      total: count ?? (data ?? []).length,
      page,
      limit,
    });
  } catch (err) {
    console.error('[GET /api/notifications] unexpected:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const title   = typeof body.title   === 'string' ? body.title.trim()   : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!title || !message) {
    return NextResponse.json({ success: false, error: 'title and message are required' }, { status: 400 });
  }

  try {
    const db = getServiceClient();
    const { data, error } = await db.from('notifications').insert({
      title,
      message,
      type:        typeof body.type === 'string' ? body.type : 'info',
      category:    typeof body.category === 'string' ? body.category : null,
      priority:    typeof body.priority === 'string' ? body.priority : 'medium',
      read:        false,
      user_id:     typeof body.user_id === 'string' ? body.user_id : null,
      client_id:   typeof body.client_id === 'string' ? body.client_id : null,
      task_id:     typeof body.task_id === 'string' ? body.task_id : null,
      entity_type: typeof body.entity_type === 'string' ? body.entity_type : null,
      entity_id:   typeof body.entity_id === 'string' ? body.entity_id : null,
      action_url:  typeof body.action_url === 'string' ? body.action_url : null,
      event_type:  typeof body.event_type === 'string' ? body.event_type : null,
      dedupe_key:  typeof body.dedupe_key === 'string' ? body.dedupe_key : null,
      metadata_json: typeof body.metadata_json === 'object' && body.metadata_json !== null ? body.metadata_json : null,
      delivery_channels: Array.isArray(body.delivery_channels) ? body.delivery_channels : ['in_app'],
    }).select().single();

    if (error) {
      console.error('[POST /api/notifications] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, notification: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notifications] unexpected:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
