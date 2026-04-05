-- Migration: Add preview metadata columns to assets table
-- These columns support in-app preview and playback for Google Drive files.

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS mime_type        TEXT,
  ADD COLUMN IF NOT EXISTS preview_url      TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url    TEXT,
  ADD COLUMN IF NOT EXISTS web_view_link    TEXT;
