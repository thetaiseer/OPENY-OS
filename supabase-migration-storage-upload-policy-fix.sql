-- OPENY OS — Supabase Storage upload policy fix
-- Ensures the upload bucket exists and authenticated users can upload/read/update.

insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do update
  set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('client-assets', 'client-assets', true)
on conflict (id) do update
  set public = excluded.public;

alter table storage.objects enable row level security;

drop policy if exists "storage_auth_upload_insert" on storage.objects;
create policy "storage_auth_upload_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  );

drop policy if exists "storage_auth_upload_select" on storage.objects;
create policy "storage_auth_upload_select"
  on storage.objects
  for select
  to authenticated
  using (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  );

drop policy if exists "storage_auth_upload_update" on storage.objects;
create policy "storage_auth_upload_update"
  on storage.objects
  for update
  to authenticated
  using (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  )
  with check (
    auth.uid() is not null
    and bucket_id in ('assets', 'client-assets')
  );
