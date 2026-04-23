/**
 * GET    /api/automations/[id]   — get rule
 * PATCH  /api/automations/[id]   — update rule (name, is_active, conditions, actions)
 * DELETE /api/automations/[id]   — delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { data, error } = await db.from('automation_rules').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 404 });
  return NextResponse.json({ success: true, rule: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager']);
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
  if (typeof body.description === 'string') allowed.description = body.description.trim();
  if (typeof body.is_active === 'boolean') allowed.is_active = body.is_active;
  if (typeof body.trigger_config === 'object') allowed.trigger_config = body.trigger_config;
  if (Array.isArray(body.conditions)) allowed.conditions = body.conditions;
  if (Array.isArray(body.actions)) allowed.actions = body.actions;
  allowed.updated_at = new Date().toISOString();

  const db = getServiceClient();
  const { data, error } = await db
    .from('automation_rules')
    .update(allowed)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, rule: data });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getServiceClient();
  const { error } = await db.from('automation_rules').delete().eq('id', id);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
