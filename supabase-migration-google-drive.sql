-- Migration: add Google Drive fields to assets table
-- Run this in your Supabase SQL editor.

alter table assets
  alter column file_path   drop not null,
  alter column bucket_name drop not null;

alter table assets
  add column if not exists view_url          text,
  add column if not exists download_url      text,
  add column if not exists storage_provider  text not null default 'supabase',
  add column if not exists drive_file_id     text;
