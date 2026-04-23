-- OPENY OS Task Manager v2 Migration
-- Run this in your Supabase SQL editor after the initial supabase-schema.sql

-- Team Members table
create table if not exists team_members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  role       text,
  avatar     text,
  created_at timestamptz not null default now()
);

-- Add new columns to tasks (safe: IF NOT EXISTS via DO block)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='created_by') then
    alter table tasks add column created_by text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='mentions') then
    alter table tasks add column mentions text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='tags') then
    alter table tasks add column tags text[] default '{}';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='tasks' and column_name='task_date') then
    alter table tasks add column task_date date;
  end if;
end $$;

-- RLS for team_members
alter table team_members enable row level security;
create policy "allow all team_members" on team_members for all using (true) with check (true);
