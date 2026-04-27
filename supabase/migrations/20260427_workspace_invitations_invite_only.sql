-- Invite-only auth: canonical workspace invitations table.
-- Safe to run multiple times.

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'manager', 'team_member')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  invited_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_invitations_workspace_id
  on public.workspace_invitations (workspace_id);

create index if not exists idx_workspace_invitations_email
  on public.workspace_invitations (lower(email));

create index if not exists idx_workspace_invitations_status
  on public.workspace_invitations (status);

create index if not exists idx_workspace_invitations_expires_at
  on public.workspace_invitations (expires_at);
