-- Guard migration: ensure content_items multi-platform columns exist in production.
-- Safe to run multiple times.

alter table if exists public.content_items
  add column if not exists platform_targets text[] not null default '{}',
  add column if not exists post_types text[] not null default '{}';

-- Verification (run manually in SQL editor if needed):
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'content_items'
--   AND column_name = 'platform_targets';

