import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * GET  /api/automations — list all automation rules
 * POST /api/automations — create a new rule
 */

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('automation_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, rules: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, trigger_type, action_type, action_config, condition_json, enabled = true } = body;

  if (!name || !trigger_type || !action_type) {
    return NextResponse.json({ success: false, error: 'name, trigger_type, and action_type are required' }, { status: 400 });
  }

  const VALID_TRIGGERS = ['task_completed', 'asset_uploaded', 'deadline_near'];
  const VALID_ACTIONS  = ['send_notification', 'link_asset_to_client', 'alert_user', 'send_slack'];

  if (!VALID_TRIGGERS.includes(trigger_type as string)) {
    return NextResponse.json({ success: false, error: `trigger_type must be one of: ${VALID_TRIGGERS.join(', ')}` }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action_type as string)) {
    return NextResponse.json({ success: false, error: `action_type must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('automation_rules')
      .insert({
        name,
        trigger_type,
        action_type,
        action_config:  action_config  ?? {},
        condition_json: condition_json ?? null,
        enabled:        Boolean(enabled),
        created_by:     auth.profile.id,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, rule: data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
