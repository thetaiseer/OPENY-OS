/**
 * GET /api/content-items
 *   List content items. Query params: client_id, status, platform
 *
 * POST /api/content-items
 *   Create a content item.
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

const VALID_STATUSES = ['draft', 'pending_review', 'approved', 'scheduled', 'published', 'rejected'] as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const clientId = searchParams.get('client_id');
  const status   = searchParams.get('status');
  const platform = searchParams.get('platform');

  try {
    const db = getSupabase();
    let query = db
      .from('content_items')
      .select(`
        *,
        client:clients(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (clientId) query = query.eq('client_id', clientId);
    if (status)   query = query.eq('status', status);
    if (platform) query = (query as unknown as { contains: (col: string, val: string[]) => typeof query }).contains('platform_targets', [platform]);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/content-items] error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const title   = typeof body.title   === 'string' ? body.title.trim()   : '';
  const clientId = typeof body.client_id === 'string' ? body.client_id.trim() : null;
  const rawStatus = typeof body.status === 'string' ? body.status : 'draft';
  const status = (VALID_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : 'draft';

  if (!title) {
    return NextResponse.json({ success: false, error: 'title is required' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    title,
    status,
    client_id:       clientId || null,
    description:     typeof body.description      === 'string' ? body.description.trim()     : null,
    caption:         typeof body.caption          === 'string' ? body.caption.trim()         : null,
    platform_targets: Array.isArray(body.platform_targets) ? body.platform_targets           : [],
    post_types:      Array.isArray(body.post_types)        ? body.post_types                 : [],
    purpose:         typeof body.purpose          === 'string' ? body.purpose                : null,
    created_by:      auth.profile.id,
  };

  try {
    const db = getSupabase();
    const { data, error } = await db
      .from('content_items')
      .insert(payload)
      .select('*, client:clients(id, name)')
      .single();

    if (error) {
      console.error('[POST /api/content-items] db error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Activity log (best-effort)
    void db.from('activities').insert({
      type:        'content_item_created',
      description: `Content item "${title}" created`,
      user_id:     auth.profile.id,
      user_uuid:   auth.profile.id,
      client_id:   clientId || null,
      entity_type: 'content_item',
      entity_id:   data?.id ?? null,
    });

    return NextResponse.json({ success: true, item: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
