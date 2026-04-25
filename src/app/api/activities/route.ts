/**
 * GET /api/activities
 *   List activity log entries with optional filters.
 *   Query params:
 *     client_id      — filter by client
 *     entity_type    — filter by entity type (task, asset, etc.)
 *     entity_id      — filter by specific entity UUID
 *     limit          — max number of results (default: 50, max: 200)
 *
 * POST /api/activities
 *   Create a new activity log entry.
 *   Body: { type, description, client_id?, entity_type?, entity_id?, metadata_json? }
 *
 * Auth: admin | manager | team
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { ACTIVITY_API_COLUMNS } from '@/lib/supabase-list-columns';

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const entityType = searchParams.get('entity_type');
  const entityId = searchParams.get('entity_id');
  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(1, isNaN(rawLimit) ? 50 : rawLimit), 200);

  try {
    const db = getServiceClient();

    let query = db
      .from('activity_log')
      .select(ACTIVITY_API_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (clientId) query = query.eq('client_id', clientId);
    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/activities] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, activities: data ?? [] });
  } catch (err) {
    console.error('[GET /api/activities] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const type = typeof body.type === 'string' ? body.type.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';

  if (!type || !description) {
    return NextResponse.json(
      { success: false, error: 'type and description are required' },
      { status: 400 },
    );
  }

  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : '';
  const entityType = typeof body.entity_type === 'string' ? body.entity_type.trim() : '';
  const entityId = typeof body.entity_id === 'string' ? body.entity_id.trim() : '';
  const metadataRaw = body.metadata_json;
  const metadata =
    metadataRaw !== null && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)
      ? metadataRaw
      : null;

  const insertPayload: Record<string, unknown> = {
    type,
    description,
    user_id: auth.profile.id,
    user_uuid: auth.profile.id,
    client_id: clientId || null,
    entity_type: entityType || null,
    entity_id: entityId || null,
    metadata_json: metadata,
  };

  try {
    const db = getServiceClient();

    const { data, error } = await db
      .from('activity_log')
      .insert(insertPayload)
      .select(ACTIVITY_API_COLUMNS)
      .single();

    if (error) {
      console.error('[POST /api/activities] db error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, activity: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/activities] unexpected error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
