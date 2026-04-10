/**
 * Automation Engine — evaluates automation rules against a trigger event.
 *
 * Rules are stored in the `automation_rules` table:
 *   id, name, trigger_type, condition_json, action_type, action_config, enabled, created_by, created_at
 *
 * Trigger types: task_completed | asset_uploaded | deadline_near |
 *                approval_requested | approval_decided | publishing_missed |
 *                new_client_added | content_item_status_changed
 *
 * Action types:  send_notification | link_asset_to_client | alert_user |
 *                send_slack | send_email | create_task |
 *                update_task_status | webhook
 *
 * Condition JSON format (all fields optional):
 *   {
 *     client_id?: string,
 *     status?: string,          // task/asset/content status to match
 *     priority?: string,        // task priority
 *     platform?: string,        // publishing platform
 *     tag?: string,             // must be in the tags array
 *   }
 */

import { createClient } from '@supabase/supabase-js';
import { sendSlackMessage } from './slack';

export type TriggerType =
  | 'task_completed'
  | 'asset_uploaded'
  | 'deadline_near'
  | 'approval_requested'
  | 'approval_decided'
  | 'publishing_missed'
  | 'new_client_added'
  | 'content_item_status_changed';

export type ActionType =
  | 'send_notification'
  | 'link_asset_to_client'
  | 'alert_user'
  | 'send_slack'
  | 'send_email'
  | 'create_task'
  | 'update_task_status'
  | 'webhook';

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
  taskId?:      string;
  assetId?:     string;
  clientId?:    string;
  userId?:      string;
  approvalId?:  string;
  scheduleId?:  string;
  contentItemId?: string;
  status?:      string;
  priority?:    string;
  platform?:    string;
  tags?:        string[];
  extra?:       Record<string, unknown>;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/**
 * Evaluate a rule's condition_json against the trigger context.
 * Returns true if the rule should fire (no conditions = always fires).
 */
function evaluateCondition(
  condition: Record<string, unknown> | null,
  ctx: TriggerContext,
): boolean {
  if (!condition || Object.keys(condition).length === 0) return true;

  // client_id match
  if (typeof condition.client_id === 'string') {
    if (ctx.clientId !== condition.client_id) return false;
  }

  // status match
  if (typeof condition.status === 'string') {
    if (ctx.status !== condition.status) return false;
  }

  // priority match
  if (typeof condition.priority === 'string') {
    if (ctx.priority !== condition.priority) return false;
  }

  // platform match
  if (typeof condition.platform === 'string') {
    if (ctx.platform !== condition.platform) return false;
  }

  // tag match (at least one tag must match)
  if (typeof condition.tag === 'string') {
    if (!ctx.tags?.includes(condition.tag)) return false;
  }

  return true;
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
      // Evaluate condition_json before executing the action
      if (!evaluateCondition(rule.condition_json, ctx)) {
        console.log(`[automation] Rule "${rule.name}" skipped — condition not met`);
        continue;
      }

      const startedAt = Date.now();
      let runStatus: 'success' | 'error' = 'success';
      let runError: string | null = null;

      try {
        await executeAction(rule, ctx, sb);
      } catch (err) {
        runStatus = 'error';
        runError = err instanceof Error ? err.message : String(err);
        console.error('[automation] Rule execution failed — rule:', rule.id, '| error:', runError);
      }

      // Log the automation run (best-effort — never throws)
      logRun(sb, {
        rule_id:        rule.id,
        trigger_type:   trigger,
        context_json:   ctx as Record<string, unknown>,
        status:         runStatus,
        error_message:  runError,
        duration_ms:    Date.now() - startedAt,
      });
    }
  } catch (err) {
    console.error('[automation] runAutomations error:', err instanceof Error ? err.message : err);
  }
}

/** Persist a run record to automation_runs (best-effort). */
function logRun(
  sb: unknown,
  run: {
    rule_id: string;
    trigger_type: string;
    context_json: Record<string, unknown>;
    status: 'success' | 'error';
    error_message: string | null;
    duration_ms: number;
  },
): void {
  void (sb as { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } })
    .from('automation_runs')
    .insert({
      rule_id:        run.rule_id,
      trigger_type:   run.trigger_type,
      context_json:   run.context_json,
      status:         run.status,
      error_message:  run.error_message,
      duration_ms:    run.duration_ms,
      executed_at:    new Date().toISOString(),
    })
    .catch((err: unknown) => {
      console.warn('[automation] Failed to log run:', err instanceof Error ? err.message : String(err));
    });
}

type SupabaseClient = ReturnType<typeof createClient>;

// Helper to bypass strict Supabase table generics for dynamic inserts/updates
function fromTable(client: SupabaseClient, table: string) {
  return (client as unknown as {
    from: (t: string) => {
      insert: (v: unknown) => Promise<unknown>;
      update: (v: unknown) => { eq: (col: string, val: unknown) => { is: (col: string, val: unknown) => Promise<unknown> } };
    }
  }).from(table);
}

async function executeAction(
  rule: AutomationRule,
  ctx: TriggerContext,
  sb: unknown,
): Promise<void> {
  const client = sb as SupabaseClient;
  const cfg = rule.action_config ?? {};

  switch (rule.action_type) {
    case 'send_notification': {
      const message = interpolate(String(cfg.message ?? rule.name), ctx);
      await fromTable(client, 'notifications').insert({
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
      await fromTable(client, 'notifications').insert({
        type:      'alert',
        message,
        user_id:   (cfg.user_id as string | undefined) ?? ctx.userId ?? null,
        client_id: ctx.clientId ?? null,
      });
      break;
    }

    case 'link_asset_to_client': {
      if (!ctx.assetId || !ctx.clientId) break;
      await fromTable(client, 'assets')
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

    case 'send_email': {
      // Requires RESEND_API_KEY. Recipient is cfg.to or the triggering user's email.
      const to = (cfg.to as string | undefined) ?? null;
      if (!to) break;
      const subject = interpolate(String(cfg.subject ?? `OPENY OS: ${rule.name}`), ctx);
      const body    = interpolate(String(cfg.message ?? `Automation triggered: ${rule.name}`), ctx);
      const { sendEmail } = await import('./email');
      await sendEmail({
        to,
        subject,
        html: `<div style="font-family:sans-serif;padding:24px"><p>${body.replace(/\n/g, '<br>')}</p></div>`,
      });
      break;
    }

    case 'create_task': {
      // Create a task from the action config
      const title     = interpolate(String(cfg.title ?? `Auto task: ${rule.name}`), ctx);
      const clientId  = (cfg.client_id as string | undefined) ?? ctx.clientId ?? null;
      const dueDate   = (cfg.due_date as string | undefined) ?? null;
      const priority  = (cfg.priority as string | undefined) ?? 'medium';
      await fromTable(client, 'tasks').insert({
        title,
        client_id:   clientId,
        priority,
        status:      'todo',
        due_date:    dueDate,
        description: `Auto-created by automation rule: ${rule.name}`,
      });
      break;
    }

    case 'update_task_status': {
      if (!ctx.taskId) break;
      const newStatus = (cfg.status as string | undefined) ?? 'in_progress';
      await (client as unknown as {
        from: (t: string) => {
          update: (v: unknown) => { eq: (col: string, val: unknown) => Promise<unknown> }
        }
      }).from('tasks').update({ status: newStatus }).eq('id', ctx.taskId);
      break;
    }

    case 'webhook': {
      // Generic HTTP POST webhook
      const url = (cfg.url as string | undefined) ?? (cfg.webhook_url as string | undefined);
      if (!url) break;
      const payload = {
        rule:    { id: rule.id, name: rule.name },
        trigger: rule.trigger_type,
        context: ctx,
        timestamp: new Date().toISOString(),
      };
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.auth_header ? { Authorization: String(cfg.auth_header) } : {}),
        },
        body: JSON.stringify(payload),
      });
      break;
    }

    default:
      console.warn('[automation] Unknown action type:', rule.action_type);
  }
}

/** Replace {{taskId}}, {{clientId}}, {{assetId}}, {{userId}}, {{status}}, {{priority}} in message templates. */
function interpolate(template: string, ctx: TriggerContext): string {
  return template
    .replace(/\{\{taskId\}\}/g,        ctx.taskId        ?? '')
    .replace(/\{\{assetId\}\}/g,       ctx.assetId       ?? '')
    .replace(/\{\{clientId\}\}/g,      ctx.clientId      ?? '')
    .replace(/\{\{userId\}\}/g,        ctx.userId        ?? '')
    .replace(/\{\{approvalId\}\}/g,    ctx.approvalId    ?? '')
    .replace(/\{\{scheduleId\}\}/g,    ctx.scheduleId    ?? '')
    .replace(/\{\{contentItemId\}\}/g, ctx.contentItemId ?? '')
    .replace(/\{\{status\}\}/g,        ctx.status        ?? '')
    .replace(/\{\{priority\}\}/g,      ctx.priority      ?? '');
}

