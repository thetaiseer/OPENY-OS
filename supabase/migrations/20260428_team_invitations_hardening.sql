-- Team invitations hardening: required columns + production-safe RLS.

create extension if not exists pgcrypto;

create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid()
);

alter table public.team_invitations
  add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade,
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists role text,
  add column if not exists status text default 'pending',
  add column if not exists token text,
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists job_title text,
  add column if not exists expires_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists created_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_invitations_token_unique'
  ) then
    alter table public.team_invitations
      add constraint team_invitations_token_unique unique (token);
  end if;
end $$;

update public.team_invitations
set status = 'pending'
where status is null;

create index if not exists team_invitations_workspace_status_idx
  on public.team_invitations (workspace_id, status);

alter table public.team_invitations enable row level security;

drop policy if exists "allow all team_invitations" on public.team_invitations;

create policy "team_invitations_read_workspace_members"
  on public.team_invitations
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = team_invitations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "team_invitations_insert_admin_owner"
  on public.team_invitations
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = team_invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  );

create policy "team_invitations_update_admin_owner"
  on public.team_invitations
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = team_invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = team_invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  );

create policy "team_invitations_delete_admin_owner"
  on public.team_invitations
  for delete
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = team_invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  );
