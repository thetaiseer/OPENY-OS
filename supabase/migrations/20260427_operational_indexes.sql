-- Operational performance indexes for daily workspace workflows.
-- Safe to run multiple times.

create index if not exists idx_tasks_workspace_due_date
  on public.tasks (workspace_id, due_date);

create index if not exists idx_tasks_assignee_id
  on public.tasks (assignee_id);

create index if not exists idx_projects_client_id
  on public.projects (client_id);
