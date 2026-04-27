export type AutomationRuleKey =
  | 'tasks.follow_up_after_project_update'
  | 'tasks.detect_overdue'
  | 'tasks.suggest_next'
  | 'tasks.auto_assign'
  | 'tasks.recurring_ops'
  | 'clients.weekly_summary'
  | 'clients.detect_inactive'
  | 'clients.no_recent_project_activity'
  | 'projects.no_upcoming_tasks'
  | 'projects.suggest_next_milestone'
  | 'projects.auto_update_health'
  | 'assets.auto_tag'
  | 'assets.detect_unused'
  | 'assets.link_related_tasks'
  | 'notifications.smart_deadline_reminders'
  | 'notifications.delayed_work_alerts'
  | 'notifications.daily_focus_digest';

export interface AutomationRuleDefinition {
  key: AutomationRuleKey;
  label: string;
  description: string;
  category: 'tasks' | 'clients' | 'projects' | 'assets' | 'notifications';
  defaultEnabled: boolean;
}

export const AUTOMATION_RULES: AutomationRuleDefinition[] = [
  {
    key: 'tasks.follow_up_after_project_update',
    label: 'Auto-create follow-up after project updates',
    description: 'Creates a follow-up task when a project update event lands without a next task.',
    category: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'tasks.detect_overdue',
    label: 'Detect overdue tasks',
    description: 'Detects overdue work and emits explainable overdue alerts.',
    category: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'tasks.suggest_next',
    label: 'Suggest next tasks',
    description: 'Suggests next tasks when project/task pipeline stalls.',
    category: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'tasks.auto_assign',
    label: 'Auto-assign tasks',
    description: 'Assigns unassigned tasks based on project owner and recent assignee history.',
    category: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'tasks.recurring_ops',
    label: 'Create recurring operational tasks',
    description: 'Creates due recurring operations tasks from schedule templates.',
    category: 'tasks',
    defaultEnabled: true,
  },
  {
    key: 'clients.weekly_summary',
    label: 'Weekly client activity summary',
    description: 'Posts a concise summary of weekly activity per active client.',
    category: 'clients',
    defaultEnabled: true,
  },
  {
    key: 'clients.detect_inactive',
    label: 'Detect inactive clients',
    description: 'Flags clients with no recent task/content activity.',
    category: 'clients',
    defaultEnabled: true,
  },
  {
    key: 'clients.no_recent_project_activity',
    label: 'Flag no recent project activity',
    description: 'Flags clients whose projects had no recent task updates.',
    category: 'clients',
    defaultEnabled: true,
  },
  {
    key: 'projects.no_upcoming_tasks',
    label: 'Detect projects with no upcoming tasks',
    description: 'Alerts when active projects have no upcoming open tasks.',
    category: 'projects',
    defaultEnabled: true,
  },
  {
    key: 'projects.suggest_next_milestone',
    label: 'Suggest next milestone',
    description: 'Suggests the next milestone task after project progress events.',
    category: 'projects',
    defaultEnabled: true,
  },
  {
    key: 'projects.auto_update_health',
    label: 'Auto-update project health',
    description: 'Updates project health status from overdue/open workload heuristics.',
    category: 'projects',
    defaultEnabled: true,
  },
  {
    key: 'assets.auto_tag',
    label: 'Auto-tag assets',
    description: 'Adds client/project/task tags to newly uploaded assets.',
    category: 'assets',
    defaultEnabled: true,
  },
  {
    key: 'assets.detect_unused',
    label: 'Detect unused assets',
    description: 'Flags ready assets not linked to task/content after a threshold.',
    category: 'assets',
    defaultEnabled: true,
  },
  {
    key: 'assets.link_related_tasks',
    label: 'Link assets to related tasks',
    description: 'Creates relation links between assets and likely matching tasks.',
    category: 'assets',
    defaultEnabled: true,
  },
  {
    key: 'notifications.smart_deadline_reminders',
    label: 'Smart reminders before deadlines',
    description: 'Sends reminder notifications ahead of due dates based on urgency.',
    category: 'notifications',
    defaultEnabled: true,
  },
  {
    key: 'notifications.delayed_work_alerts',
    label: 'Delayed-work alerts',
    description: 'Alerts owners when in-progress work stalls for multiple days.',
    category: 'notifications',
    defaultEnabled: true,
  },
  {
    key: 'notifications.daily_focus_digest',
    label: 'Daily focus digest',
    description: 'Sends each team member a daily summary of priority and due work.',
    category: 'notifications',
    defaultEnabled: true,
  },
];
