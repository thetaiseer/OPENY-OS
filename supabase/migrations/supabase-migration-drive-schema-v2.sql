-- Migration: add all required columns for the Google Drive upload flow (v2)
-- Run this in your Supabase SQL editor.
--
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS).

-- 1. Make previously-required columns nullable (they are unused for Drive assets)
alter table assets
  alter column file_path   drop not null,
  alter column bucket_name drop not null;

-- 2. Add Google Drive columns (added by supabase-migration-google-drive.sql, repeated here for safety)
alter table assets
  add column if not exists view_url          text,
  add column if not exists download_url      text,
  add column if not exists storage_provider  text not null default 'supabase',
  add column if not exists drive_file_id     text;

-- 3. Add new Drive-folder tracking columns
alter table assets
  add column if not exists drive_folder_id    text,
  add column if not exists client_folder_name text;

-- 4. Add content_type with an allowed-values constraint
alter table assets
  add column if not exists content_type text;

-- Apply the check constraint only if it does not already exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'assets' and constraint_name = 'assets_content_type_check'
  ) then
    alter table assets
      add constraint assets_content_type_check
      check (content_type is null or content_type in (
        'SOCIAL_POSTS', 'REELS', 'VIDEOS', 'LOGOS', 'BRAND_ASSETS',
        'PASSWORDS', 'DOCUMENTS', 'RAW_FILES', 'ADS_CREATIVES', 'REPORTS', 'OTHER'
      ));
  end if;
end$$;

-- 5. Add month_key with a YYYY-MM format constraint
alter table assets
  add column if not exists month_key text;

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'assets' and constraint_name = 'assets_month_key_check'
  ) then
    alter table assets
      add constraint assets_month_key_check
      check (month_key is null or month_key ~ '^\d{4}-(0[1-9]|1[0-2])$');
  end if;
end$$;
