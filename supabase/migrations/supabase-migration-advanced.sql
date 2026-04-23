-- ── Advanced Assets: tags, versioning ────────────────────────────────────────
-- Run this migration in your Supabase SQL editor.

-- Add tags column (array of text) to assets table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_asset_id uuid REFERENCES public.assets(id) ON DELETE SET NULL;

-- GIN index for fast array search on tags
CREATE INDEX IF NOT EXISTS assets_tags_gin_idx ON public.assets USING GIN (tags);

-- ── Manager role ──────────────────────────────────────────────────────────────
-- Add 'manager' to profiles role column (if using a CHECK constraint, update it)
-- If your role column uses an enum type, alter the enum instead.
-- Example for text column with CHECK constraint (adjust as needed):
-- ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
--   CHECK (role IN ('admin', 'manager', 'team_member', 'viewer', 'client'));

-- ── Notifications table (if not yet created) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       text,
  message    text,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id  uuid,
  task_id    uuid,
  asset_id   uuid,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_created_idx ON public.notifications (created_at DESC);
