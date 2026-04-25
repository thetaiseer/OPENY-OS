/**
 * GET  /api/entity-links?source_type=&source_id=  — list links for an entity
 * POST /api/entity-links                           — create a link
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { ENTITY_LINK_COLUMNS } from '@/lib/supabase-list-columns';

const VALID_ENTITY_TYPES = [
  'task',
  'asset',
  'content',
  'client',
  'project',
  'note',
  'template',
] as const;
const VALID_LINK_TYPES = [
  'related',
  'blocks',
  'blocked_by',
  'parent',
  'child',
  'duplicate',
] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const sourceType = searchParams.get('source_type');
  const sourceId = searchParams.get('source_id');
  const targetType = searchParams.get('target_type');
  const targetId = searchParams.get('target_id');

  const db = getServiceClient();
  let query = db
    .from('entity_links')
    .select(ENTITY_LINK_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);

  if (sourceType && sourceId) {
    query = query.eq('source_type', sourceType).eq('source_id', sourceId);
  } else if (targetType && targetId) {
    query = query.eq('target_type', targetType).eq('target_id', targetId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, links: data ?? [] });
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

  const sourceType = typeof body.source_type === 'string' ? body.source_type : '';
  const sourceId = typeof body.source_id === 'string' ? body.source_id.trim() : '';
  const targetType = typeof body.target_type === 'string' ? body.target_type : '';
  const targetId = typeof body.target_id === 'string' ? body.target_id.trim() : '';
  const linkType = typeof body.link_type === 'string' ? body.link_type : 'related';

  if (
    !(VALID_ENTITY_TYPES as readonly string[]).includes(sourceType) ||
    !(VALID_ENTITY_TYPES as readonly string[]).includes(targetType)
  ) {
    return NextResponse.json({ success: false, error: 'Invalid entity type' }, { status: 400 });
  }
  if (!(VALID_LINK_TYPES as readonly string[]).includes(linkType)) {
    return NextResponse.json({ success: false, error: 'Invalid link_type' }, { status: 400 });
  }
  if (!sourceId || !targetId) {
    return NextResponse.json(
      { success: false, error: 'source_id and target_id are required' },
      { status: 400 },
    );
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from('entity_links')
    .upsert(
      {
        source_type: sourceType,
        source_id: sourceId,
        target_type: targetType,
        target_id: targetId,
        link_type: linkType,
        metadata: body.metadata ?? null,
        created_by: auth.profile.id,
      },
      { onConflict: 'source_type,source_id,target_type,target_id' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, link: data }, { status: 201 });
}
