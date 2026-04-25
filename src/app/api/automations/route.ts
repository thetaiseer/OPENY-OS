/**
 * GET  /api/automations        — list automation rules
 * POST /api/automations        — create a rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service-client';
import { requireRole } from '@/lib/api-auth';
import { AUTOMATION_RULE_COLUMNS } from '@/lib/supabase-list-columns';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const active = searchParams.get('active');

  const db = getServiceClient();
  let query = db.from('automations').select(AUTOMATION_RULE_COLUMNS).order('created_at');
  if (active === 'true') query = query.eq('is_active', true);
  if (active === 'false') query = query.eq('is_active', false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, rules: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const triggerType = typeof body.trigger_type === 'string' ? body.trigger_type.trim() : '';

  if (!name)
    return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 });
  if (!triggerType)
    return NextResponse.json(
      { success: false, error: 'trigger_type is required' },
      { status: 400 },
    );

  const db = getServiceClient();
  const { data, error } = await db
    .from('automations')
    .insert({
      name,
      description: typeof body.description === 'string' ? body.description.trim() : null,
      is_active: body.is_active !== false,
      trigger_type: triggerType,
      trigger_config: typeof body.trigger_config === 'object' ? body.trigger_config : {},
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      actions: Array.isArray(body.actions) ? body.actions : [],
      created_by: auth.profile.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, rule: data }, { status: 201 });
}
