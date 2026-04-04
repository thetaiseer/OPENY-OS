-- OPENY OS — Users & Roles Migration
-- Run this in your Supabase SQL editor AFTER the base schema (supabase-schema.sql).
--
-- Creates:
--   public.profiles    — one row per auth.users entry, stores name / role / client_id
--   RLS policies       — each user can read their own row; admins can read all
--   Trigger            — auto-inserts a row into public.profiles on new sign-up

-- ── 1. profiles table ─────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text        not null default '',
  email       text        not null default '',
  role        text        not null default 'client'
                check (role in ('admin', 'team', 'client')),
  client_id   uuid        references public.clients (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── 2. Row Level Security ─────────────────────────────────────────────────────
alter table public.profiles enable row level security;

-- A user can always read their own profile row.
create policy "profiles_read_own"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Admins can read every profile row (needed for admin dashboards / team management).
create policy "profiles_admin_read_all"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Only admins can insert / update / delete profile rows directly.
-- Normal sign-up rows are created via the trigger below (security definer).
create policy "profiles_admin_write"
  on public.profiles
  for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );

-- ── 3. Trigger: auto-create profile on sign-up ────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
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
