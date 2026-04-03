-- Migration: Rebuild Google Drive asset storage structure
-- Adds structured metadata columns for CLIENT → CONTENT_TYPE → MONTH hierarchy

alter table assets
  add column if not exists client_name        text,
  add column if not exists client_folder_name text,
  add column if not exists content_type       text,
  add column if not exists month_key          text,
  add column if not exists uploaded_by        text,
  add column if not exists drive_folder_id    text;
