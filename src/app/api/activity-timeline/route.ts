/**
 * GET /api/activity-timeline
 *
 * Returns the workspace-wide permanent activity timeline.
 * Supports filtering by:
 *  - category (tasks|content|assets|team|system)
 *  - entity_type (task|asset|content_item|client|team_member|...)
 *  - client_id
 *  - from / to  (ISO date strings for date range)
 *  - q  (text search in title/description)
 *  - page / limit  (pagination)
 *
 * Access:
 *  - owner|admin|manager: full audit visibility
 *  - other roles: only their own related activities
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const moduleName = searchParams.get('module');
  const status = searchParams.get('status');
  const type = searchParams.get('type');
  const entityType = searchParams.get('entity_type');
  const clientId = searchParams.get('client_id');
  const actorId = searchParams.get('actor_id');
  const userRole = searchParams.get('user_role');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const q = searchParams.get('q')?.trim() ?? '';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '30', 10) || 30, 1), 100);
  const offset = (page - 1) * limit;

  try {
    const db = getServiceClient();

    let query = db
      .from('activities')
      .select(
        `
        id,
        type,
        module,
        status,
        user_role,
        category,
        title,
        description,
        entity_type,
        entity_id,
        related_entity_type,
        related_entity_id,
        actor_id,
        user_uuid,
        client_id,
        before_value,
        after_value,
        metadata_json,
        workspace_id,
        created_at
      `,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const isAuditViewer = ['owner', 'admin', 'manager'].includes(auth.profile.role);
    if (!isAuditViewer) {
      query = query.or(`actor_id.eq.${auth.profile.id},user_uuid.eq.${auth.profile.id}`);
    }

    if (category) query = query.eq('category', category);
    if (moduleName) query = query.eq('module', moduleName);
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (entityType) query = query.eq('entity_type', entityType);
    if (clientId) query = query.eq('client_id', clientId);
    if (actorId) query = query.eq('actor_id', actorId);
    if (userRole) query = query.eq('user_role', userRole);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (q) {
      // Sanitize special LIKE characters to prevent unexpected wildcard behavior
      const sanitizedQ = q.replace(/[%_\\]/g, (c) => `\\${c}`);
      query = query.or(`title.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[GET /api/activity-timeline] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const actorIds = Array.from(
      new Set(
        (data ?? [])
          .map((row) => row.actor_id ?? row.user_uuid)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );
    const actorNameById: Record<string, string> = {};
    if (actorIds.length > 0) {
      const { data: members } = await db
        .from('team_members')
        .select('profile_id,full_name,email')
        .in('profile_id', actorIds);
      for (const member of members ?? []) {
        const key = member.profile_id as string | null;
        if (!key) continue;
        actorNameById[key] =
          (member.full_name as string | null) ||
          (member.email as string | null) ||
          actorNameById[key] ||
          '';
      }
    }

    const activities = (data ?? []).map((row) => {
      const actorKey = (row.actor_id as string | null) ?? (row.user_uuid as string | null) ?? null;
      return {
        ...row,
        actor_name: actorKey ? (actorNameById[actorKey] ?? null) : null,
      };
    });

    return NextResponse.json({
      success: true,
      activities,
      total: count ?? 0,
      page,
      pageSize: limit,
      hasMore: activities.length === limit,
    });
  } catch (err) {
    console.error('[GET /api/activity-timeline] unexpected:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
