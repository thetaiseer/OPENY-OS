/**
 * Automation Engine — evaluates automation rules against a trigger event.
 *
 * Rules are stored in the `automation_rules` table:
 *   id, name, trigger_type, condition_json, action_type, action_config, enabled, created_by, created_at
 *
 * Trigger types: task_completed | asset_uploaded | deadline_near
 * Action types:  send_notification | link_asset_to_client | alert_user | send_slack
 */

import { createClient } from '@supabase/supabase-js';
import { sendSlackMessage } from './slack';

export type TriggerType = 'task_completed' | 'asset_uploaded' | 'deadline_near';
export type ActionType  = 'send_notification' | 'link_asset_to_client' | 'alert_user' | 'send_slack';

export interface AutomationRule {
  id:             string;
  name:           string;
  trigger_type:   TriggerType;
  condition_json: Record<string, unknown> | null;
  action_type:    ActionType;
  action_config:  Record<string, unknown>;
  enabled:        boolean;
}

export interface TriggerContext {
  taskId?:   string;
  assetId?:  string;
  clientId?: string;
  userId?:   string;
  extra?:    Record<string, unknown>;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Run all enabled automation rules matching the given trigger type.
 * Errors in individual rules are logged but do not throw.
 */
export async function runAutomations(trigger: TriggerType, ctx: TriggerContext): Promise<void> {
  try {
    const sb = getSupabase();
    const { data: rules, error } = await sb
      .from('automation_rules')
      .select('*')
      .eq('trigger_type', trigger)
      .eq('enabled', true);

    if (error) {
      console.warn('[automation] Failed to fetch rules:', error.message);
      return;
    }

    for (const rule of (rules ?? []) as AutomationRule[]) {
      try {
        await executeAction(rule, ctx, sb);
      } catch (err) {
        console.error('[automation] Rule execution failed — rule:', rule.id, '| error:', err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('[automation] runAutomations error:', err instanceof Error ? err.message : err);
  }
}

async function executeAction(
  rule: AutomationRule,
  ctx: TriggerContext,
  sb: ReturnType<typeof createClient>,
): Promise<void> {
  const cfg = rule.action_config ?? {};

  switch (rule.action_type) {
    case 'send_notification': {
      const message = interpolate(String(cfg.message ?? rule.name), ctx);
      await sb.from('notifications').insert({
        type:       'automation',
        message,
        user_id:    ctx.userId ?? cfg.user_id ?? null,
        client_id:  ctx.clientId ?? null,
        task_id:    ctx.taskId   ?? null,
        asset_id:   ctx.assetId  ?? null,
      });
      break;
    }

    case 'alert_user': {
      const message = interpolate(String(cfg.message ?? `Automation alert: ${rule.name}`), ctx);
      await sb.from('notifications').insert({
        type:      'alert',
        message,
        user_id:   (cfg.user_id as string | undefined) ?? ctx.userId ?? null,
        client_id: ctx.clientId ?? null,
      });
      break;
    }

    case 'link_asset_to_client': {
      if (!ctx.assetId || !ctx.clientId) break;
      await sb.from('assets')
        .update({ client_id: ctx.clientId })
        .eq('id', ctx.assetId)
        .is('client_id', null);
      break;
    }

    case 'send_slack': {
      const webhookUrl = (cfg.webhook_url as string | undefined) ?? process.env.SLACK_WEBHOOK_URL;
      if (!webhookUrl) break;
      const message = interpolate(String(cfg.message ?? `OPENY OS: ${rule.name}`), ctx);
      await sendSlackMessage(webhookUrl, { text: message });
      break;
    }

    default:
      console.warn('[automation] Unknown action type:', rule.action_type);
  }
}

/** Replace {{taskId}}, {{clientId}}, {{assetId}} in message templates. */
function interpolate(template: string, ctx: TriggerContext): string {
  return template
    .replace(/\{\{taskId\}\}/g,   ctx.taskId   ?? '')
    .replace(/\{\{assetId\}\}/g,  ctx.assetId  ?? '')
    .replace(/\{\{clientId\}\}/g, ctx.clientId ?? '')
    .replace(/\{\{userId\}\}/g,   ctx.userId   ?? '');
}
