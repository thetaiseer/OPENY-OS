-- Migration: add file_type, file_size, bucket_name columns to assets table
-- Run this in your Supabase SQL editor if the assets table already exists.

alter table assets
  add column if not exists file_type   text,
  add column if not exists file_size   bigint,
  add column if not exists bucket_name text not null default 'client-assets';
