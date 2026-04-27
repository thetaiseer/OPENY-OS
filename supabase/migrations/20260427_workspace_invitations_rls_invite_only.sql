-- Invite-only workspace invitations schema hardening.
-- Idempotent migration.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null,
  token text unique not null,
  status text not null default 'pending',
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.workspace_invitations
  alter column status set default 'pending';

alter table public.workspace_invitations
  add column if not exists accepted_at timestamptz;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workspace_invitations'
      and column_name = 'invited_by'
  ) then
    begin
      alter table public.workspace_invitations
        drop constraint if exists workspace_invitations_invited_by_fkey;
      alter table public.workspace_invitations
        add constraint workspace_invitations_invited_by_fkey
        foreign key (invited_by) references auth.users(id);
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists idx_workspace_invitations_workspace_id
  on public.workspace_invitations (workspace_id);

create index if not exists idx_workspace_invitations_email
  on public.workspace_invitations (email);

create index if not exists idx_workspace_invitations_token
  on public.workspace_invitations (token);

create index if not exists idx_workspace_invitations_status
  on public.workspace_invitations (status);

alter table public.workspace_invitations enable row level security;

drop policy if exists "owners_admins_manage_workspace_invitations" on public.workspace_invitations;
create policy "owners_admins_manage_workspace_invitations"
  on public.workspace_invitations
  for all
  using (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.user_id = auth.uid()
        and wm.workspace_id = workspace_invitations.workspace_id
        and wm.is_active = true
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_memberships wm
      where wm.user_id = auth.uid()
        and wm.workspace_id = workspace_invitations.workspace_id
        and wm.is_active = true
        and wm.role in ('owner', 'admin')
    )
  );
