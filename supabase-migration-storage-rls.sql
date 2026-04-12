-- ============================================================================
-- Supabase Storage RLS policies for the "client-assets" bucket
--
-- Run this migration once in the Supabase SQL Editor.
--
-- This script is idempotent — it is safe to run multiple times.
--
-- What this does:
--   1. Creates the "client-assets" storage bucket (public, 250 MB file size limit).
--   2. Enables Row Level Security on storage.objects.
--   3. Creates RLS policies so authenticated users can upload, read, update,
--      and delete files in the "client-assets" bucket.
--
-- Note: Server-side API routes use the SUPABASE_SERVICE_ROLE_KEY which
-- bypasses RLS automatically. These policies are also needed for any
-- direct client-side storage access (e.g. presigned URLs, browser uploads).
--
-- IMPORTANT — ensure the following environment variables are set in your
-- deployment (Vercel / .env.local):
--   NEXT_PUBLIC_SUPABASE_URL      — your Supabase project URL
--   NEXT_PUBLIC_SUPABASE_ANON_KEY — your Supabase anon/public key
--   SUPABASE_SERVICE_ROLE_KEY     — your Supabase service role key
--                                   (used by /api/upload for server-side uploads)
-- ============================================================================

-- ── 1. Create the client-assets bucket ───────────────────────────────────────
-- public = true  → files are accessible via the /storage/v1/object/public/ URL
--                  without authentication (required for the public URLs stored
--                  in file_url / preview_url / thumbnail_url columns).
-- file_size_limit → 250 MB, matching the server-side MAX_FILE_SIZE constant.
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-assets', 'client-assets', true, 262144000)  -- 250 MB = 250 * 1024 * 1024
on conflict (id) do update
  set public          = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- ── 2. Enable RLS on storage.objects ─────────────────────────────────────────
-- Already enabled by default on hosted Supabase; included for self-hosted setups.
alter table storage.objects enable row level security;

-- ── 3. Upload policy ─────────────────────────────────────────────────────────
-- Authenticated users may upload files to the "client-assets" bucket.
-- Path convention enforced by the application: {user_id}/{timestamp}_{filename}
-- The check on bucket_id scopes this policy exclusively to our bucket.
drop policy if exists "Allow authenticated upload to assets" on storage.objects;
drop policy if exists "Allow authenticated upload to client-assets" on storage.objects;
create policy "Allow authenticated upload to client-assets"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'client-assets');

-- ── 4. Read policy ────────────────────────────────────────────────────────────
-- Authenticated users may read (list/download) any file in the "client-assets" bucket.
-- Public reads via /object/public/ URLs bypass this policy — they are governed
-- by the bucket's public flag set above.
drop policy if exists "Allow authenticated read from assets" on storage.objects;
drop policy if exists "Allow authenticated read from client-assets" on storage.objects;
create policy "Allow authenticated read from client-assets"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'client-assets');

-- ── 5. Update policy ──────────────────────────────────────────────────────────
-- Authenticated users may update (overwrite/upsert) objects in the "client-assets" bucket.
drop policy if exists "Allow authenticated update to assets" on storage.objects;
drop policy if exists "Allow authenticated update to client-assets" on storage.objects;
create policy "Allow authenticated update to client-assets"
  on storage.objects
  for update
  to authenticated
  using     (bucket_id = 'client-assets')
  with check (bucket_id = 'client-assets');

-- ── 6. Delete policy ─────────────────────────────────────────────────────────
-- Authenticated users may delete files from the "client-assets" bucket.
-- Access control for deletion is enforced at the API route level
-- (DELETE /api/assets/[id] requires admin or team role).
drop policy if exists "Allow authenticated delete from assets" on storage.objects;
drop policy if exists "Allow authenticated delete from client-assets" on storage.objects;
create policy "Allow authenticated delete from client-assets"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'client-assets');
