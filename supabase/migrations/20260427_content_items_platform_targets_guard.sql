-- Guard migration: ensure content_items multi-platform columns exist in production.
-- Safe to run multiple times.

alter table if exists public.content_items
  add column if not exists platform_targets text[] not null default '{}',
  add column if not exists post_types text[] not null default '{}';

