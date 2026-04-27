import { getServiceClient } from '@/lib/supabase/service-client';
import { processEvent } from '@/lib/event-engine';
import { AUTOMATION_RULES, type AutomationRuleKey } from '@/lib/automations/rules';
import { getWorkspaceAutomationSettings } from '@/lib/automations/settings';

const TERMINAL_TASK_STATUSES = ['completed', 'cancelled', 'published', 'delivered'];
const DAY_MS = 86_400_000;

interface AutomationRunResult {
  workspaceId: string;
  executedRules: string[];
  actions: number;
  errors: string[];
}

interface RuleContext {
  workspaceId: string;
  now: Date;
  enabled: (ruleKey: AutomationRuleKey) => boolean;
}

export async function runWorkspaceAutomations(workspaceId: string): Promise<AutomationRunResult> {
  const now = new Date();
  const result: AutomationRunResult = {
    workspaceId,
    executedRules: [],
    actions: 0,
    errors: [],
  };

  const settings = await getWorkspaceAutomationSettings(workspaceId);
  const ctx: RuleContext = {
    workspaceId,
    now,
    enabled: (ruleKey) => settings[ruleKey]?.enabled ?? false,
  };

  const runners: Array<[AutomationRuleKey, (ctx: RuleContext) => Promise<number>]> = [
    ['tasks.follow_up_after_project_update', runTaskFollowUpAfterProjectUpdates],
    ['tasks.detect_overdue', runTaskOverdueDetection],
    ['tasks.suggest_next', runTaskSuggestion],
    ['tasks.auto_assign', runTaskAutoAssign],
    ['tasks.recurring_ops', runRecurringTasks],
    ['clients.weekly_summary', runClientWeeklySummary],
    ['clients.detect_inactive', runClientInactiveDetection],
    ['clients.no_recent_project_activity', runClientNoRecentProjectActivity],
    ['projects.no_upcoming_tasks', runProjectNoUpcomingTasks],
    ['projects.suggest_next_milestone', runProjectMilestoneSuggestion],
    ['projects.auto_update_health', runProjectHealthUpdate],
    ['assets.auto_tag', runAssetAutoTagging],
    ['assets.detect_unused', runAssetUnusedDetection],
    ['assets.link_related_tasks', runAssetTaskLinking],
    ['notifications.smart_deadline_reminders', runSmartDeadlineReminders],
    ['notifications.delayed_work_alerts', runDelayedWorkAlerts],
    ['notifications.daily_focus_digest', runDailyFocusDigest],
  ];

  for (const [ruleKey, ruleRunner] of runners) {
    if (!ctx.enabled(ruleKey)) continue;
    result.executedRules.push(ruleKey);
    try {
      result.actions += await ruleRunner(ctx);
    } catch (error) {
      result.errors.push(`${ruleKey}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

export async function runAutomationsAcrossWorkspaces(): Promise<AutomationRunResult[]> {
  const db = getServiceClient();
  const { data, error } = await db.from('workspaces').select('id');
  if (error) throw new Error(error.message);
  const out: AutomationRunResult[] = [];
  for (const row of data ?? []) {
    out.push(await runWorkspaceAutomations(row.id as string));
  }
  return out;
}

async function runTaskFollowUpAfterProjectUpdates(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const since = new Date(ctx.now.getTime() - DAY_MS).toISOString();
  const { data: events, error } = await db
    .from('workspace_events')
    .select('id, entity_id, created_at, actor_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('event_type', 'project.updated')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const ev of events ?? []) {
    const projectId = ev.entity_id as string | null;
    if (!projectId) continue;
    const exists = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('project_id', projectId)
      .ilike('title', 'Follow-up:%')
      .gte('created_at', since);
    if ((exists.count ?? 0) > 0) continue;

    const { data: project } = await db
      .from('projects')
      .select('id, name, client_id, created_by')
      .eq('id', projectId)
      .eq('workspace_id', ctx.workspaceId)
      .maybeSingle();
    if (!project) continue;

    const dueAt = new Date(ctx.now.getTime() + 2 * DAY_MS).toISOString();
    const { data: task, error: taskError } = await db
      .from('tasks')
      .insert({
        workspace_id: ctx.workspaceId,
        title: `Follow-up: ${project.name}`,
        description: 'Auto-created from recent project update to keep momentum.',
        status: 'todo',
        priority: 'medium',
        due_date: dueAt,
        project_id: project.id,
        client_id: project.client_id ?? null,
        assignee_id: project.created_by ?? null,
        created_by_id: ev.actor_id ?? null,
      })
      .select('id, title')
      .maybeSingle();
    if (taskError || !task) continue;
    actions++;
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'task',
      entity_id: task.id as string,
      actor_id: ev.actor_id ?? null,
      payload: {
        title: 'Automation: Follow-up task created',
        message: `Created "${task.title}" after project update`,
        rule: 'tasks.follow_up_after_project_update',
        status: 'success',
      },
    });
  }
  return actions;
}

async function runTaskOverdueDetection(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const { data, error } = await db
    .from('tasks')
    .select('id, title, due_date, assignee_id')
    .eq('workspace_id', ctx.workspaceId)
    .lt('due_date', ctx.now.toISOString())
    .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .limit(50);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const task of data ?? []) {
    const dueAt = task.due_date ? new Date(task.due_date).getTime() : ctx.now.getTime();
    const daysOverdue = Math.max(1, Math.floor((ctx.now.getTime() - dueAt) / DAY_MS));
    await processEvent({
      event_type: 'task.overdue',
      workspace_id: ctx.workspaceId,
      entity_type: 'task',
      entity_id: task.id as string,
      recipients: [task.assignee_id as string | null],
      payload: { taskTitle: task.title, daysOverdue, source: 'automation' },
    });
    actions++;
  }
  return actions;
}

async function runTaskSuggestion(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const { data: projects, error } = await db
    .from('projects')
    .select('id, name, created_by')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .limit(30);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const project of projects ?? []) {
    const { count: openTasks } = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('project_id', project.id)
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`);
    if ((openTasks ?? 0) > 2) continue;

    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'project',
      entity_id: project.id as string,
      recipients: [project.created_by as string | null],
      payload: {
        title: 'Suggested next task',
        message: `Project "${project.name}" may need a next task to keep delivery moving.`,
        suggestion: 'Create next milestone task',
        rule: 'tasks.suggest_next',
        status: 'success',
      },
    });
    actions++;
  }
  return actions;
}

async function runTaskAutoAssign(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, project_id, client_id')
    .eq('workspace_id', ctx.workspaceId)
    .is('assignee_id', null)
    .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const task of tasks ?? []) {
    let assigneeId: string | null = null;
    if (task.project_id) {
      const { data: latestPeer } = await db
        .from('tasks')
        .select('assignee_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('project_id', task.project_id)
        .not('assignee_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      assigneeId = (latestPeer?.assignee_id as string | null) ?? null;

      if (!assigneeId) {
        const { data: project } = await db
          .from('projects')
          .select('created_by')
          .eq('workspace_id', ctx.workspaceId)
          .eq('id', task.project_id)
          .maybeSingle();
        assigneeId = (project?.created_by as string | null) ?? null;
      }
    }
    if (!assigneeId) continue;

    const { error: updateErr } = await db
      .from('tasks')
      .update({ assignee_id: assigneeId, updated_at: ctx.now.toISOString() })
      .eq('id', task.id)
      .eq('workspace_id', ctx.workspaceId);
    if (updateErr) continue;
    actions++;
    await processEvent({
      event_type: 'task.assigned',
      workspace_id: ctx.workspaceId,
      entity_type: 'task',
      entity_id: task.id as string,
      recipients: [assigneeId],
      payload: {
        taskTitle: task.title,
        source: 'automation.auto_assign',
      },
    });
  }
  return actions;
}

async function runRecurringTasks(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const { data: schedules, error } = await db
    .from('recurring_task_schedules')
    .select(
      'id, title, description, client_id, project_id, assignee_id, frequency, interval_count, next_run_at',
    )
    .eq('workspace_id', ctx.workspaceId)
    .eq('is_active', true)
    .lte('next_run_at', ctx.now.toISOString())
    .limit(50);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const sched of schedules ?? []) {
    const dueAt = new Date(ctx.now.getTime() + DAY_MS).toISOString();
    const { data: created } = await db
      .from('tasks')
      .insert({
        workspace_id: ctx.workspaceId,
        title: sched.title,
        description: sched.description,
        status: 'todo',
        priority: 'medium',
        due_date: dueAt,
        client_id: sched.client_id ?? null,
        project_id: sched.project_id ?? null,
        assignee_id: sched.assignee_id ?? null,
      })
      .select('id')
      .maybeSingle();
    if (!created) continue;

    const intervalCount = Number(sched.interval_count ?? 1);
    const next = new Date(sched.next_run_at as string);
    if (sched.frequency === 'daily') next.setDate(next.getDate() + intervalCount);
    if (sched.frequency === 'weekly') next.setDate(next.getDate() + 7 * intervalCount);
    if (sched.frequency === 'monthly') next.setMonth(next.getMonth() + intervalCount);
    await db
      .from('recurring_task_schedules')
      .update({
        last_run_at: ctx.now.toISOString(),
        last_task_id: created.id as string,
        next_run_at: next.toISOString(),
        updated_at: ctx.now.toISOString(),
      })
      .eq('id', sched.id)
      .eq('workspace_id', ctx.workspaceId);
    actions++;
  }
  return actions;
}

async function runClientWeeklySummary(ctx: RuleContext): Promise<number> {
  const day = ctx.now.getUTCDay();
  if (day !== 1) return 0;
  const db = getServiceClient();
  const since = new Date(ctx.now.getTime() - 7 * DAY_MS).toISOString();

  const { data: clients, error } = await db
    .from('clients')
    .select('id, name')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .limit(50);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const client of clients ?? []) {
    const tasks = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_id', client.id)
      .gte('updated_at', since);
    const assets = await db
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_id', client.id)
      .gte('created_at', since);

    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'client',
      entity_id: client.id as string,
      payload: {
        title: `Weekly summary: ${client.name}`,
        message: `${tasks.count ?? 0} task updates and ${assets.count ?? 0} assets this week.`,
        rule: 'clients.weekly_summary',
      },
    });
    actions++;
  }
  return actions;
}

async function runClientInactiveDetection(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const threshold = new Date(ctx.now.getTime() - 21 * DAY_MS).toISOString();
  const { data: clients, error } = await db
    .from('clients')
    .select('id, name')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .lt('updated_at', threshold)
    .limit(50);
  if (error) throw new Error(error.message);
  let actions = 0;
  for (const client of clients ?? []) {
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'client',
      entity_id: client.id as string,
      payload: {
        title: 'Inactive client detected',
        message: `"${client.name}" has low activity in the last 21 days.`,
        rule: 'clients.detect_inactive',
      },
    });
    actions++;
  }
  return actions;
}

async function runClientNoRecentProjectActivity(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const threshold = new Date(ctx.now.getTime() - 14 * DAY_MS).toISOString();
  const { data: projects, error } = await db
    .from('projects')
    .select('id, name, client_id, updated_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .lt('updated_at', threshold)
    .not('client_id', 'is', null)
    .limit(60);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const proj of projects ?? []) {
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'project',
      entity_id: proj.id as string,
      payload: {
        title: 'No recent project activity',
        message: `Project "${proj.name}" has no recent updates.`,
        rule: 'clients.no_recent_project_activity',
      },
    });
    actions++;
  }
  return actions;
}

async function runProjectNoUpcomingTasks(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const in10Days = new Date(ctx.now.getTime() + 10 * DAY_MS).toISOString();
  const { data: projects, error } = await db
    .from('projects')
    .select('id, name, created_by')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .limit(40);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const project of projects ?? []) {
    const { count } = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('project_id', project.id)
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`)
      .lte('due_date', in10Days);
    if ((count ?? 0) > 0) continue;
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'project',
      entity_id: project.id as string,
      recipients: [project.created_by as string | null],
      payload: {
        title: 'No upcoming tasks',
        message: `Project "${project.name}" has no upcoming tasks in the next 10 days.`,
        rule: 'projects.no_upcoming_tasks',
      },
    });
    actions++;
  }
  return actions;
}

async function runProjectMilestoneSuggestion(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const threshold = new Date(ctx.now.getTime() - 3 * DAY_MS).toISOString();
  const { data: projects, error } = await db
    .from('projects')
    .select('id, name, created_by')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .gte('updated_at', threshold)
    .limit(30);
  if (error) throw new Error(error.message);
  let actions = 0;
  for (const project of projects ?? []) {
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'project',
      entity_id: project.id as string,
      recipients: [project.created_by as string | null],
      payload: {
        title: 'Suggested milestone',
        message: `Consider adding the next milestone for "${project.name}".`,
        suggestion: 'Define milestone deliverable and due date',
        rule: 'projects.suggest_next_milestone',
      },
    });
    actions++;
  }
  return actions;
}

async function runProjectHealthUpdate(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const { data: projects, error } = await db
    .from('projects')
    .select('id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .limit(50);
  if (error) throw new Error(error.message);
  let actions = 0;
  for (const project of projects ?? []) {
    const overdue = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('project_id', project.id)
      .lt('due_date', ctx.now.toISOString())
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`);
    const open = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('project_id', project.id)
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`);

    let nextHealth: 'healthy' | 'at_risk' | 'critical' = 'healthy';
    if ((overdue.count ?? 0) >= 5) nextHealth = 'critical';
    else if ((overdue.count ?? 0) > 0 || (open.count ?? 0) >= 12) nextHealth = 'at_risk';

    const { error: updateErr } = await db
      .from('projects')
      .update({ health_status: nextHealth, updated_at: ctx.now.toISOString() })
      .eq('id', project.id)
      .eq('workspace_id', ctx.workspaceId);
    if (!updateErr) actions++;
  }
  return actions;
}

async function runAssetAutoTagging(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const since = new Date(ctx.now.getTime() - DAY_MS).toISOString();
  const { data: assets, error } = await db
    .from('assets')
    .select('id, name, client_name, project_id, task_id, tags')
    .eq('workspace_id', ctx.workspaceId)
    .gte('created_at', since)
    .limit(60);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const asset of assets ?? []) {
    const existingTags = Array.isArray(asset.tags) ? (asset.tags as string[]) : [];
    const merged = new Set(existingTags);
    if (asset.client_name) merged.add(`client:${String(asset.client_name).toLowerCase()}`);
    if (asset.project_id) merged.add(`project:${asset.project_id}`);
    if (asset.task_id) merged.add(`task:${asset.task_id}`);
    if (merged.size === existingTags.length) continue;
    const { error: updateErr } = await db
      .from('assets')
      .update({ tags: Array.from(merged) })
      .eq('id', asset.id)
      .eq('workspace_id', ctx.workspaceId);
    if (!updateErr) actions++;
  }
  return actions;
}

async function runAssetUnusedDetection(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const threshold = new Date(ctx.now.getTime() - 14 * DAY_MS).toISOString();
  const { data: assets, error } = await db
    .from('assets')
    .select('id, name')
    .eq('workspace_id', ctx.workspaceId)
    .lt('created_at', threshold)
    .is('task_id', null)
    .limit(40);
  if (error) throw new Error(error.message);
  let actions = 0;
  for (const asset of assets ?? []) {
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'asset',
      entity_id: asset.id as string,
      payload: {
        title: 'Unused asset detected',
        message: `Asset "${asset.name}" appears unused in the last 14 days.`,
        rule: 'assets.detect_unused',
      },
    });
    actions++;
  }
  return actions;
}

async function runAssetTaskLinking(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const { data: assets, error } = await db
    .from('assets')
    .select('id, name, task_id, client_id')
    .eq('workspace_id', ctx.workspaceId)
    .is('task_id', null)
    .limit(30);
  if (error) throw new Error(error.message);
  let actions = 0;
  for (const asset of assets ?? []) {
    const { data: task } = await db
      .from('tasks')
      .select('id')
      .eq('workspace_id', ctx.workspaceId)
      .eq('client_id', asset.client_id ?? null)
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!task?.id) continue;
    const { error: updateErr } = await db
      .from('assets')
      .update({ task_id: task.id })
      .eq('id', asset.id)
      .eq('workspace_id', ctx.workspaceId);
    if (!updateErr) actions++;
  }
  return actions;
}

async function runSmartDeadlineReminders(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const in48h = new Date(ctx.now.getTime() + 2 * DAY_MS).toISOString();
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, due_date, assignee_id')
    .eq('workspace_id', ctx.workspaceId)
    .gt('due_date', ctx.now.toISOString())
    .lte('due_date', in48h)
    .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`)
    .limit(60);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const task of tasks ?? []) {
    await processEvent({
      event_type: 'task.due_soon',
      workspace_id: ctx.workspaceId,
      entity_type: 'task',
      entity_id: task.id as string,
      recipients: [task.assignee_id as string | null],
      payload: { taskTitle: task.title, source: 'automation.smart_deadline_reminders' },
    });
    actions++;
  }
  return actions;
}

async function runDelayedWorkAlerts(ctx: RuleContext): Promise<number> {
  const db = getServiceClient();
  const staleDate = new Date(ctx.now.getTime() - 3 * DAY_MS).toISOString();
  const { data: tasks, error } = await db
    .from('tasks')
    .select('id, title, assignee_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'in_progress')
    .lt('updated_at', staleDate)
    .limit(50);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const task of tasks ?? []) {
    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      entity_type: 'task',
      entity_id: task.id as string,
      recipients: [task.assignee_id as string | null],
      payload: {
        title: 'Delayed work alert',
        message: `"${task.title}" has been in progress without updates for 3+ days.`,
        rule: 'notifications.delayed_work_alerts',
      },
    });
    actions++;
  }
  return actions;
}

async function runDailyFocusDigest(ctx: RuleContext): Promise<number> {
  const hour = ctx.now.getUTCHours();
  if (hour !== 6) return 0;
  const db = getServiceClient();
  const in24h = new Date(ctx.now.getTime() + DAY_MS).toISOString();
  const { data: members, error } = await db
    .from('team_members')
    .select('profile_id, full_name')
    .eq('status', 'active')
    .limit(120);
  if (error) throw new Error(error.message);

  let actions = 0;
  for (const member of members ?? []) {
    if (!member.profile_id) continue;
    const due = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('assignee_id', member.profile_id)
      .lte('due_date', in24h)
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`);
    const overdue = await db
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', ctx.workspaceId)
      .eq('assignee_id', member.profile_id)
      .lt('due_date', ctx.now.toISOString())
      .not('status', 'in', `(${TERMINAL_TASK_STATUSES.map((s) => `"${s}"`).join(',')})`);

    await processEvent({
      event_type: 'automation.run',
      workspace_id: ctx.workspaceId,
      recipients: [member.profile_id],
      payload: {
        title: 'Daily focus digest',
        message: `You have ${due.count ?? 0} due soon and ${overdue.count ?? 0} overdue tasks.`,
        rule: 'notifications.daily_focus_digest',
      },
    });
    actions++;
  }
  return actions;
}

export function getAutomationArchitectureSummary() {
  return {
    modules: ['rule-catalog', 'workspace-rule-settings', 'automation-runner', 'cron-trigger'],
    rules: AUTOMATION_RULES.length,
  };
}
