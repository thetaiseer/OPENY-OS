import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * PATCH /api/automations/:id — update a rule (toggle enabled, update fields)
 * DELETE /api/automations/:id — delete a rule
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  // Only allow safe fields to be patched
  const allowed: Record<string, unknown> = {};
  if (typeof body.enabled      === 'boolean') allowed.enabled      = body.enabled;
  if (typeof body.name         === 'string')  allowed.name         = body.name;
  if (typeof body.action_config === 'object') allowed.action_config = body.action_config;

  if (!Object.keys(allowed).length) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('automation_rules')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, error: 'Rule not found' }, { status: 404 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true, rule: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const sb = getSupabase();
    const { error } = await sb
      .from('automation_rules')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
