import { getServiceClient } from '@/lib/supabase/service-client';
import { AUTOMATION_RULES, type AutomationRuleKey } from '@/lib/automations/rules';

export interface WorkspaceAutomationRuleSetting {
  rule_key: AutomationRuleKey;
  enabled: boolean;
  config: Record<string, unknown>;
}

export async function getWorkspaceAutomationSettings(
  workspaceId: string,
): Promise<Record<AutomationRuleKey, WorkspaceAutomationRuleSetting>> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('workspace_automation_settings')
    .select('rule_key, enabled, config')
    .eq('workspace_id', workspaceId);
  if (error) throw new Error(error.message);

  const byKey = new Map<string, { enabled: boolean; config: Record<string, unknown> }>();
  for (const row of data ?? []) {
    byKey.set(row.rule_key as string, {
      enabled: Boolean(row.enabled),
      config: (row.config as Record<string, unknown> | null) ?? {},
    });
  }

  const merged = {} as Record<AutomationRuleKey, WorkspaceAutomationRuleSetting>;
  for (const rule of AUTOMATION_RULES) {
    const existing = byKey.get(rule.key);
    merged[rule.key] = {
      rule_key: rule.key,
      enabled: existing?.enabled ?? rule.defaultEnabled,
      config: existing?.config ?? {},
    };
  }
  return merged;
}

export async function upsertWorkspaceAutomationSetting(params: {
  workspaceId: string;
  ruleKey: AutomationRuleKey;
  enabled: boolean;
  config?: Record<string, unknown>;
}): Promise<void> {
  const db = getServiceClient();
  const { error } = await db.from('workspace_automation_settings').upsert(
    {
      workspace_id: params.workspaceId,
      rule_key: params.ruleKey,
      enabled: params.enabled,
      config: params.config ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,rule_key' },
  );
  if (error) throw new Error(error.message);
}
