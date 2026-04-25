-- Ensure user_sessions contains columns used by API/session security UI.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS public.user_sessions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text;
