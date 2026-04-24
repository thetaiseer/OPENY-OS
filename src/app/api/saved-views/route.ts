/**
 * GET  /api/saved-views         — list saved views
 * POST /api/saved-views         — create a saved view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { SAVED_VIEW_COLUMNS } from '@/lib/supabase-list-columns';

const VALID_ENTITY_TYPES = ['task', 'asset', 'content', 'client', 'project'] as const;
const VALID_VIEW_TYPES = [
  'list',
  'kanban',
  'calendar',
  'timeline',
  'table',
  'grid',
  'pipeline',
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entity_type');
  const userId = searchParams.get('user_id');

  const db = getServiceClient();
  let query = db
    .from('saved_views')
    .select(SAVED_VIEW_COLUMNS)
    .order('is_default', { ascending: false })
    .order('created_at');

  if (entityType) query = query.eq('entity_type', entityType);
  if (userId) {
    // Return views for this user or shared views
    query = query.or(`user_id.eq.${userId},is_shared.eq.true`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, views: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const entityType = typeof body.entity_type === 'string' ? body.entity_type : '';
  const viewType = typeof body.view_type === 'string' ? body.view_type : 'list';

  if (!name)
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  if (!(VALID_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return NextResponse.json({ success: false, error: 'Invalid entity_type' }, { status: 400 });
  }
  if (!(VALID_VIEW_TYPES as readonly string[]).includes(viewType)) {
    return NextResponse.json({ success: false, error: 'Invalid view_type' }, { status: 400 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('saved_views')
    .insert({
      user_id: auth.profile.id,
      entity_type: entityType,
      name,
      view_type: viewType,
      filters: typeof body.filters === 'object' ? body.filters : {},
      sort_config: typeof body.sort_config === 'object' ? body.sort_config : {},
      group_by: typeof body.group_by === 'string' ? body.group_by : null,
      columns: Array.isArray(body.columns) ? body.columns : [],
      is_default: body.is_default === true,
      is_shared: body.is_shared === true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, view: data }, { status: 201 });
}
