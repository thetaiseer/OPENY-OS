-- Assets lifecycle hardening + RLS tightening (idempotent)

alter table public.assets
  add column if not exists deleted_at timestamptz,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists sync_status text not null default 'synced',
  add column if not exists missing_in_storage boolean not null default false,
  add column if not exists storage_key text,
  add column if not exists storage_provider text not null default 'r2';

create index if not exists idx_assets_workspace_deleted
  on public.assets (workspace_id, deleted_at, is_deleted);

create index if not exists idx_assets_workspace_sync
  on public.assets (workspace_id, missing_in_storage, sync_status);

create index if not exists idx_assets_storage_key
  on public.assets (storage_key);

alter table public.assets enable row level security;

drop policy if exists "assets_select_workspace_members" on public.assets;
create policy "assets_select_workspace_members"
  on public.assets
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = assets.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.is_active, true) = true
    )
    or exists (
      select 1
      from public.workspace_memberships wms
      join public.workspaces w
        on w.slug = wms.workspace_key
      where w.id = assets.workspace_id
        and wms.user_id = auth.uid()
        and wms.is_active = true
    )
  );

drop policy if exists "assets_update_workspace_admins" on public.assets;
create policy "assets_update_workspace_admins"
  on public.assets
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = assets.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.is_active, true) = true
        and wm.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships wms
      join public.workspaces w
        on w.slug = wms.workspace_key
      where w.id = assets.workspace_id
        and wms.user_id = auth.uid()
        and wms.is_active = true
        and wms.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = assets.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.is_active, true) = true
        and wm.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships wms
      join public.workspaces w
        on w.slug = wms.workspace_key
      where w.id = assets.workspace_id
        and wms.user_id = auth.uid()
        and wms.is_active = true
        and wms.role in ('owner', 'admin')
    )
  );

drop policy if exists "assets_delete_workspace_admins" on public.assets;
create policy "assets_delete_workspace_admins"
  on public.assets
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = assets.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.is_active, true) = true
        and wm.role in ('owner', 'admin')
    )
    or exists (
      select 1
      from public.workspace_memberships wms
      join public.workspaces w
        on w.slug = wms.workspace_key
      where w.id = assets.workspace_id
        and wms.user_id = auth.uid()
        and wms.is_active = true
        and wms.role in ('owner', 'admin')
    )
  );
