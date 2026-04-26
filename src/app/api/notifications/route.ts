/**
 * GET  /api/notifications — list notifications for the current user
 * POST /api/notifications — create a notification (admin/manager only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { NOTIFICATION_LIST_COLUMNS } from '@/lib/supabase-list-columns';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member', 'client']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get('user_id');
  const unreadOnly = searchParams.get('unread') === 'true';
  const readFilter = searchParams.get('read'); // true|false
  const category = searchParams.get('category'); // tasks|content|assets|team|system
  const moduleName = searchParams.get('module');
  const type = searchParams.get('type');
  const archived = searchParams.get('archived') === 'true';
  const priority = searchParams.get('priority'); // low|medium|high|critical
  const q = searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100);
  const offset = (page - 1) * limit;
  const isAdminLike = auth.profile.role === 'admin' || auth.profile.role === 'owner';
  const userId = isAdminLike && requestedUserId ? requestedUserId : auth.profile.id;

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
      .from('notifications')
      .select(NOTIFICATION_LIST_COLUMNS)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    query = query.or(`user_id.eq.${userId},user_id.is.null`);

    // Default: exclude archived unless explicitly requested
    if (!archived) {
      query = query.eq('is_archived', false);
    }

    if (unreadOnly) query = query.eq('read', false);
    if (readFilter === 'true') query = query.eq('read', true);
    if (readFilter === 'false') query = query.eq('read', false);
    if (category) query = query.eq('category', category);
    if (moduleName) query = query.eq('module', moduleName);
    if (type) query = query.eq('type', type);
    if (priority) query = query.eq('priority', priority);
    if (q) {
      const sanitizedQ = q.replace(/[%_\\]/g, (c) => `\\${c}`);
      query = query.or(`title.ilike.%${sanitizedQ}%,message.ilike.%${sanitizedQ}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/notifications] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Attempt to filter by is_archived; guarded in case the migration has not been
    // applied yet on a given environment (column may not exist on older schemas).
    let countQuery = db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('read', false);
    try {
      countQuery = countQuery.eq('is_archived', false);
    } catch {
      /* is_archived column not yet present — skip filter */
    }
    const { count: unreadCount } = await countQuery;

    return NextResponse.json({
      success: true,
      notifications: data ?? [],
      unreadCount: unreadCount ?? 0,
      page,
      pageSize: limit,
      hasMore: (data ?? []).length === limit,
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
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!title || !message) {
    return NextResponse.json(
      { success: false, error: 'title and message are required' },
      { status: 400 },
    );
  }

  const moduleNameRaw = typeof body.module === 'string' ? body.module.trim() : '';
  const moduleName =
    moduleNameRaw ||
    (typeof body.event_type === 'string' && body.event_type.includes('.')
      ? body.event_type.split('.')[0]
      : 'system');

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
    const targetRolesRaw = Array.isArray(body.target_roles) ? body.target_roles : [];
    const targetRoles = targetRolesRaw.filter(
      (r): r is string => typeof r === 'string' && r.length > 0,
    );
    const targetUserIdsRaw = Array.isArray(body.user_ids) ? body.user_ids : [];
    const targetUserIds = targetUserIdsRaw.filter(
      (u): u is string => typeof u === 'string' && u.length > 0,
    );
    const recipientIds = new Set<string>();
    if (targetUserIds.length > 0) {
      for (const uid of targetUserIds) recipientIds.add(uid);
    }
    if (targetRoles.length > 0) {
      const { data: members } = await db
        .from('team_members')
        .select('profile_id,role')
        .in('role', targetRoles)
        .not('profile_id', 'is', null);
      for (const member of members ?? []) {
        const pid = member.profile_id as string | null;
        if (pid) recipientIds.add(pid);
      }
    }
    const recipients = Array.from(recipientIds);

    const payloadBase = {
      workspace_id: workspaceId,
      title,
      message,
      module: moduleName,
      type: typeof body.type === 'string' ? body.type : 'info',
      priority: typeof body.priority === 'string' ? body.priority : 'medium',
      category: typeof body.category === 'string' ? body.category : null,
      read: false,
      is_archived: false,
      actor_id:
        typeof body.actorId === 'string'
          ? body.actorId
          : typeof body.actor_id === 'string'
            ? body.actor_id
            : auth.profile.id,
      created_by: auth.profile.id,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
      client_id: typeof body.client_id === 'string' ? body.client_id : null,
      task_id: typeof body.task_id === 'string' ? body.task_id : null,
      entity_type: typeof body.entity_type === 'string' ? body.entity_type : null,
      entity_id: typeof body.entity_id === 'string' ? body.entity_id : null,
      action_url:
        typeof body.actionUrl === 'string'
          ? body.actionUrl
          : typeof body.action_url === 'string'
            ? body.action_url
            : null,
      event_type:
        typeof body.eventType === 'string'
          ? body.eventType
          : typeof body.event_type === 'string'
            ? body.event_type
            : null,
    };

    const rows =
      recipients.length > 0
        ? recipients.map((uid) => ({ ...payloadBase, user_id: uid }))
        : [
            {
              ...payloadBase,
              user_id:
                typeof body.userId === 'string'
                  ? body.userId
                  : typeof body.user_id === 'string'
                    ? body.user_id
                    : null,
            },
          ];

    const { data, error } = await db.from('notifications').insert(rows).select();
    if (error) {
      console.error('[POST /api/notifications] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { success: true, notification: data?.[0] ?? null, notifications: data ?? [] },
      { status: 201 },
    );
  } catch (err) {
    console.error('[POST /api/notifications] unexpected:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
