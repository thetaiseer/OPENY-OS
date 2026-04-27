-- Intelligent workflow automations foundation.
-- Safe/idempotent migration.

create table if not exists public.workspace_automation_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rule_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, rule_key)
);

create index if not exists workspace_automation_settings_workspace_idx
  on public.workspace_automation_settings(workspace_id);

alter table public.workspace_automation_settings enable row level security;
drop policy if exists "workspace_automation_settings: team read" on public.workspace_automation_settings;
create policy "workspace_automation_settings: team read"
  on public.workspace_automation_settings for select
  using (public.current_user_role() in ('owner', 'admin', 'manager', 'team_member'));

drop policy if exists "workspace_automation_settings: admin write" on public.workspace_automation_settings;
create policy "workspace_automation_settings: admin write"
  on public.workspace_automation_settings for all
  using (public.current_user_role() in ('owner', 'admin', 'manager'));

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'health_status'
  ) then
    alter table public.projects
      add column health_status text not null default 'healthy'
      check (health_status in ('healthy', 'at_risk', 'critical'));
  end if;
end
$$;

create index if not exists projects_workspace_health_idx
  on public.projects(workspace_id, health_status);

create table if not exists public.recurring_task_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  assignee_id uuid references auth.users(id) on delete set null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  interval_count int not null default 1,
  next_run_at timestamptz not null,
  is_active boolean not null default true,
  last_run_at timestamptz,
  last_task_id uuid references public.tasks(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_task_schedules_workspace_idx
  on public.recurring_task_schedules(workspace_id, is_active, next_run_at);

alter table public.recurring_task_schedules enable row level security;
drop policy if exists "recurring_task_schedules: team read" on public.recurring_task_schedules;
create policy "recurring_task_schedules: team read"
  on public.recurring_task_schedules for select
  using (public.current_user_role() in ('owner', 'admin', 'manager', 'team_member'));

drop policy if exists "recurring_task_schedules: admin write" on public.recurring_task_schedules;
create policy "recurring_task_schedules: admin write"
  on public.recurring_task_schedules for all
  using (public.current_user_role() in ('owner', 'admin', 'manager'));

