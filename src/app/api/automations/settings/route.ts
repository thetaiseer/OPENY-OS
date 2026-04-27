import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getServiceClient } from '@/lib/supabase/service-client';
import { resolveWorkspaceForRequest } from '@/lib/api-workspace';
import { AUTOMATION_RULES, type AutomationRuleKey } from '@/lib/automations/rules';
import {
  getWorkspaceAutomationSettings,
  upsertWorkspaceAutomationSetting,
} from '@/lib/automations/settings';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['owner', 'admin', 'manager', 'team_member']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  const { workspaceId, error } = await resolveWorkspaceForRequest(req, db, auth.profile.id);
  if (!workspaceId || error) {
    return NextResponse.json(
      { success: false, error: error ?? 'Workspace not found' },
      { status: 400 },
    );
  }

  const settings = await getWorkspaceAutomationSettings(workspaceId);
  const rules = AUTOMATION_RULES.map((rule) => ({
    ...rule,
    enabled: settings[rule.key]?.enabled ?? rule.defaultEnabled,
    config: settings[rule.key]?.config ?? {},
  }));
  return NextResponse.json({ success: true, rules });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRole(req, ['owner', 'admin', 'manager']);
  if (auth instanceof NextResponse) return auth;

  const db = getServiceClient();
  const { workspaceId, error } = await resolveWorkspaceForRequest(req, db, auth.profile.id);
  if (!workspaceId || error) {
    return NextResponse.json(
      { success: false, error: error ?? 'Workspace not found' },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const ruleKey = String(body.rule_key ?? '').trim() as AutomationRuleKey;
  const enabled = Boolean(body.enabled);
  if (!AUTOMATION_RULES.find((r) => r.key === ruleKey)) {
    return NextResponse.json({ success: false, error: 'Unknown rule_key' }, { status: 400 });
  }

  await upsertWorkspaceAutomationSetting({
    workspaceId,
    ruleKey,
    enabled,
    config:
      typeof body.config === 'object' && body.config
        ? (body.config as Record<string, unknown>)
        : {},
  });

  return NextResponse.json({ success: true });
}
