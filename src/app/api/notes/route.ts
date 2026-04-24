/**
 * GET  /api/notes            — list notes
 * POST /api/notes            — create a note
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { NOTE_COLUMNS } from '@/lib/supabase-list-columns';
import { emitEvent, EVENT } from '@/lib/workspace-events';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');
  const pinned = searchParams.get('pinned');
  const search = searchParams.get('search');

  const db = getServiceClient();
  let query = db
    .from('notes')
    .select(NOTE_COLUMNS)
    .order('is_pinned', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(200);

  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);
  if (pinned === 'true') query = query.eq('is_pinned', true);
  if (search) query = query.ilike('title', `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, notes: data ?? [] });
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

  const title = typeof body.title === 'string' ? body.title.trim() : 'Untitled';

  const VALID_ENTITY_TYPES = ['client', 'task', 'project', 'asset', 'content'] as const;
  const rawEntityType = typeof body.entity_type === 'string' ? body.entity_type : null;
  const entityType =
    rawEntityType && (VALID_ENTITY_TYPES as readonly string[]).includes(rawEntityType)
      ? rawEntityType
      : null;

  const payload: Record<string, unknown> = {
    title,
    content: typeof body.content === 'string' ? body.content : null,
    entity_type: entityType,
    entity_id: typeof body.entity_id === 'string' ? body.entity_id : null,
    is_pinned: body.is_pinned === true,
    created_by: auth.profile.id,
  };

  const db = getServiceClient();
  const { data, error } = await db.from('notes').insert(payload).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  void emitEvent(db, {
    event_type: EVENT.NOTE_CREATED,
    entity_type: 'note',
    entity_id: data?.id,
    actor_id: auth.profile.id,
    payload: { title },
  });

  return NextResponse.json({ success: true, note: data }, { status: 201 });
}
