-- Ensure assets lifecycle columns exist + add active folder index safely.
alter table public.assets
  add column if not exists deleted_at timestamptz,
  add column if not exists is_deleted boolean default false,
  add column if not exists sync_status text default 'synced',
  add column if not exists missing_in_storage boolean default false,
  add column if not exists storage_key text,
  add column if not exists storage_provider text default 'r2';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assets'
      and column_name = 'folder'
  ) then
    execute '
      create index if not exists assets_workspace_folder_active_idx
      on public.assets (workspace_id, folder)
      where deleted_at is null and coalesce(is_deleted, false) = false
    ';
  end if;
end
$$;
