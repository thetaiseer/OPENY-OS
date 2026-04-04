import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getApiUser } from '@/lib/api-auth';

// ── Supabase service-role client (server only, bypasses RLS) ──────────────────
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

const PAGE_SIZE = 100;

/**
 * GET /api/assets
 *
 * Returns paginated assets from the database.
 * - admin / team: all assets
 * - client: only assets belonging to their client_id
 *
 * Query params:
 *   page – 0-indexed page number (default: 0)
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getApiUser(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { profile } = auth;

    const { searchParams } = new URL(req.url);
    const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0);
    const from = page * PAGE_SIZE;
    const to   = from + PAGE_SIZE - 1;

    const supabase = getSupabase();
    let query = supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    // Client role: profiles no longer carry client_id, so we cannot scope
    // results to a specific client — return an empty list to avoid exposing
    // all assets until RLS policies are tightened.
    if (profile.role === 'client') {
      return NextResponse.json({ success: true, assets: [], page, hasMore: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('[GET /api/assets] Supabase error:', error.message, error.details ?? '');
      return NextResponse.json(
        { success: false, error: `Failed to fetch assets: ${error.message}${error.details ? ` — ${error.details}` : ''}` },
        { status: 500 },
      );
    }

    const assets = data ?? [];
    return NextResponse.json({
      success: true,
      assets,
      page,
      hasMore: assets.length === PAGE_SIZE,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[GET /api/assets] unexpected error:', msg);
    return NextResponse.json(
      { success: false, error: `Unexpected server error: ${msg}` },
      { status: 500 },
    );
  }
}
