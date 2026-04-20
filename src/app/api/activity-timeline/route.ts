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
 * Access: admin|manager can view all; team_member can view workspace activity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const category    = searchParams.get('category');
  const entityType  = searchParams.get('entity_type');
  const clientId    = searchParams.get('client_id');
  const from        = searchParams.get('from');
  const to          = searchParams.get('to');
  const q           = searchParams.get('q')?.trim() ?? '';
  const page        = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
  const limit       = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '30', 10) || 30, 1), 100);
  const offset      = (page - 1) * limit;

  try {
    const db = getServiceClient();

    let query = db
      .from('activities')
      .select(`
        id,
        type,
        category,
        title,
        description,
        entity_type,
        entity_id,
        actor_id,
        user_uuid,
        client_id,
        before_value,
        after_value,
        metadata_json,
        workspace_id,
        created_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category)   query = query.eq('category', category);
    if (entityType) query = query.eq('entity_type', entityType);
    if (clientId)   query = query.eq('client_id', clientId);
    if (from)       query = query.gte('created_at', from);
    if (to)         query = query.lte('created_at', to);
    if (q) {
      // Sanitize special LIKE characters to prevent unexpected wildcard behavior
      const sanitizedQ = q.replace(/[%_\\]/g, c => `\\${c}`);
      query = query.or(`title.ilike.%${sanitizedQ}%,description.ilike.%${sanitizedQ}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[GET /api/activity-timeline] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success:    true,
      activities: data ?? [],
      total:      count ?? 0,
      page,
      pageSize:   limit,
      hasMore:    (data ?? []).length === limit,
    });
  } catch (err) {
    console.error('[GET /api/activity-timeline] unexpected:', err);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
