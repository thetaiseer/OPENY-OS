-- Align invitation schema/policies with Team invite flow.

alter table public.invitations
  add column if not exists access_role text,
  add column if not exists status text default 'pending',
  add column if not exists team_member_id text,
  add column if not exists updated_at timestamptz default now();

update public.invitations
set status = coalesce(status, 'pending'),
    access_role = coalesce(access_role, role),
    updated_at = coalesce(updated_at, created_at, now())
where true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'invitations_status_check'
  ) then
    alter table public.invitations
      add constraint invitations_status_check
      check (status in ('pending', 'invited', 'accepted', 'expired', 'revoked'));
  end if;
end $$;

alter table public.invitations enable row level security;

drop policy if exists "Restrict all access" on public.invitations;
drop policy if exists "invitations_rw" on public.invitations;

create policy "invitations_read_workspace_members"
  on public.invitations
  for select
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
    )
  );

create policy "invitations_insert_owner_admin"
  on public.invitations
  for insert
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  );

create policy "invitations_update_owner_admin"
  on public.invitations
  for update
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  );

create policy "invitations_delete_owner_admin"
  on public.invitations
  for delete
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = invitations.workspace_id
        and wm.user_id = auth.uid()
        and lower(wm.role) in ('owner', 'admin')
    )
  );
