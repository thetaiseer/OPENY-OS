-- Allow viewer in workspace_invitations.role CHECK (API also maps viewer → team_member).
-- Idempotent: drop named check if present, re-add expanded check.

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'workspace_invitations'
      and c.conname = 'workspace_invitations_role_check'
  ) then
    alter table public.workspace_invitations
      drop constraint workspace_invitations_role_check;
  end if;
exception
  when undefined_object then null;
end $$;

do $$
begin
  alter table public.workspace_invitations
    add constraint workspace_invitations_role_check
    check (role in ('owner', 'admin', 'manager', 'team_member', 'viewer'));
exception
  when duplicate_object then null;
end $$;
