-- OPENY OS — Session / Login History Migration
-- Run this in your Supabase SQL editor

create table if not exists user_sessions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  ip_address   text,
  country      text,
  city         text,
  user_agent   text,
  browser      text,
  os           text,
  device_type  text,
  is_active    boolean     not null default true,
  last_seen_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  revoked_by   text,
  risk_flag    boolean     not null default false
);

-- Fast lookup by user
create index if not exists idx_user_sessions_user_id
  on user_sessions(user_id);

-- Fast lookup of active sessions per user
create index if not exists idx_user_sessions_user_active
  on user_sessions(user_id, is_active)
  where is_active = true;

-- Enable Row Level Security
alter table user_sessions enable row level security;

-- Users can read their own sessions only
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'user_sessions' and policyname = 'users_select_own_sessions'
  ) then
    create policy "users_select_own_sessions"
      on user_sessions for select
      using (auth.uid() = user_id);
  end if;
end $$;
