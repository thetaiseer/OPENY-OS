-- OPENY OS — Users & Roles Migration
-- Run this in your Supabase SQL editor AFTER the base schema (supabase-schema.sql).
--
-- Creates:
--   public.users       — one row per auth.users entry, stores name / role / client_id
--   RLS policies       — each user can read their own row; admins can read all
--   Trigger            — auto-inserts a row into public.users on new sign-up

-- ── 1. users table ────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null default '',
  email       text        not null default '',
  role        text        not null default 'client'
                check (role in ('admin', 'team', 'client')),
  client_id   uuid        references public.clients (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── 2. Row Level Security ─────────────────────────────────────────────────────
alter table public.users enable row level security;

-- A user can always read their own profile row.
create policy "users_read_own"
  on public.users
  for select
  using (auth.uid() = id);

-- Admins can read every user row (needed for admin dashboards / team management).
create policy "users_admin_read_all"
  on public.users
  for select
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  );

-- Only admins can insert / update / delete user rows directly.
-- Normal sign-up rows are created via the trigger below (security definer).
create policy "users_admin_write"
  on public.users
  for all
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  );

-- ── 3. Trigger: auto-create user profile on sign-up ──────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop the trigger if it already exists so the migration is re-runnable.
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
