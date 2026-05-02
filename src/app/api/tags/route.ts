/**
 * GET  /api/tags   — list tags
 * POST /api/tags   — create a tag
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { TAG_COLUMNS } from '@/lib/supabase-list-columns';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');

  const db = getServiceClient();
  let query = db.from('tags').select(TAG_COLUMNS).order('name');

  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, tags: data ?? [] });
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
  if (!name)
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from('tags')
    .upsert(
      {
        name,
        color: typeof body.color === 'string' ? body.color.trim() : 'var(--text-secondary)',
        description: typeof body.description === 'string' ? body.description.trim() : null,
      },
      { onConflict: 'workspace_id,name' },
    )
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, tag: data }, { status: 201 });
}
