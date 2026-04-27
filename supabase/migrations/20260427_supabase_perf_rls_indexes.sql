-- Performance + RLS support indexes for OPENY OS multi-tenant workloads.
-- Safe migration: only additive indexes.

-- Core workspace scoping
create index if not exists idx_workspace_members_workspace_user
  on public.workspace_members (workspace_id, user_id);

create index if not exists idx_workspace_members_user_workspace
  on public.workspace_members (user_id, workspace_id);

create index if not exists idx_clients_workspace_created
  on public.clients (workspace_id, created_at desc);

create index if not exists idx_clients_workspace_name
  on public.clients (workspace_id, name);

create index if not exists idx_projects_workspace_created
  on public.projects (workspace_id, created_at desc);

create index if not exists idx_projects_workspace_client
  on public.projects (workspace_id, client_id);

create index if not exists idx_projects_workspace_status
  on public.projects (workspace_id, status);

create index if not exists idx_tasks_workspace_created
  on public.tasks (workspace_id, created_at desc);

create index if not exists idx_tasks_workspace_due
  on public.tasks (workspace_id, due_date);

create index if not exists idx_tasks_workspace_status
  on public.tasks (workspace_id, status);

create index if not exists idx_tasks_workspace_assignee
  on public.tasks (workspace_id, assignee_id);

create index if not exists idx_tasks_workspace_client
  on public.tasks (workspace_id, client_id);

create index if not exists idx_assets_workspace_created
  on public.assets (workspace_id, created_at desc);

create index if not exists idx_assets_workspace_client
  on public.assets (workspace_id, client_id);

create index if not exists idx_assets_workspace_type
  on public.assets (workspace_id, content_type);

create index if not exists idx_content_items_workspace_created
  on public.content_items (workspace_id, created_at desc);

create index if not exists idx_content_items_workspace_status
  on public.content_items (workspace_id, status);

create index if not exists idx_content_items_workspace_client
  on public.content_items (workspace_id, client_id);

create index if not exists idx_activities_workspace_created
  on public.activities (workspace_id, created_at desc);

create index if not exists idx_activities_workspace_entity
  on public.activities (workspace_id, entity_type, entity_id);

create index if not exists idx_notifications_workspace_user_created
  on public.notifications (workspace_id, user_id, created_at desc);

create index if not exists idx_notifications_workspace_user_unread
  on public.notifications (workspace_id, user_id, read);

-- Docs/accounting-related
create index if not exists idx_docs_invoices_workspace_created
  on public.docs_invoices (workspace_id, created_at desc);

create index if not exists idx_docs_employees_workspace_created
  on public.docs_employees (workspace_id, created_at desc);

create index if not exists idx_docs_accounting_entries_workspace_date
  on public.docs_accounting_entries (workspace_id, entry_date desc);

-- Permissions lookups
create index if not exists idx_member_permissions_team_member_workspace_module
  on public.member_permissions (team_member_id, workspace, module);

-- Publishing schedule access patterns
create index if not exists idx_publishing_schedules_workspace_date
  on public.publishing_schedules (workspace_id, scheduled_date);
