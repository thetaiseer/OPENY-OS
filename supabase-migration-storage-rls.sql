-- ============================================================================
-- Supabase Storage RLS policies for the "assets" bucket
--
-- Run this migration once in the Supabase SQL Editor.
--
-- Before running, ensure the "assets" bucket exists in
-- Storage → Buckets in your Supabase dashboard.
-- You can create it with:
--   insert into storage.buckets (id, name, public)
--   values ('assets', 'assets', true)
--   on conflict (id) do nothing;
-- ============================================================================

-- Create the assets bucket if it does not already exist.
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true)
on conflict (id) do nothing;

-- Enable Row Level Security on storage.objects (already on by default in
-- hosted Supabase, but included here for self-hosted setups).
alter table storage.objects enable row level security;

-- ── Upload policy ────────────────────────────────────────────────────────────
-- Authenticated users may upload files to the "assets" bucket.
-- Path convention enforced by the application: {userId}/{timestamp}_{filename}
-- The check (bucket_id = 'assets') scopes this policy to our bucket only.
drop policy if exists "Allow authenticated upload to assets" on storage.objects;
create policy "Allow authenticated upload to assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'assets');

-- ── Read policy ──────────────────────────────────────────────────────────────
-- Authenticated users may read any file in the "assets" bucket.
drop policy if exists "Allow authenticated read from assets" on storage.objects;
create policy "Allow authenticated read from assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'assets');

-- ── Delete policy ────────────────────────────────────────────────────────────
-- Authenticated users may delete files in the "assets" bucket.
-- The application restricts who may call DELETE /api/assets/[id] via role
-- checks (admin/team only), so this policy grants the service-role key
-- (used server-side) the ability to remove files.
drop policy if exists "Allow authenticated delete from assets" on storage.objects;
create policy "Allow authenticated delete from assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'assets');
