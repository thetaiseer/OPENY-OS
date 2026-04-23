/**
 * PATCH  /api/saved-views/[id]  — update a view
 * DELETE /api/saved-views/[id]  — delete a view
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const allowed: Record<string, unknown> = {};
  if (typeof body.name === 'string') allowed.name = body.name.trim();
  if (typeof body.view_type === 'string') allowed.view_type = body.view_type;
  if (typeof body.filters === 'object') allowed.filters = body.filters;
  if (typeof body.sort_config === 'object') allowed.sort_config = body.sort_config;
  if (typeof body.group_by === 'string') allowed.group_by = body.group_by || null;
  if (Array.isArray(body.columns)) allowed.columns = body.columns;
  if (typeof body.is_default === 'boolean') allowed.is_default = body.is_default;
  if (typeof body.is_shared === 'boolean') allowed.is_shared = body.is_shared;

  const db = getServiceClient();
  const { data, error } = await db
    .from('saved_views')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, view: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('saved_views').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
