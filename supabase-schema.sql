-- OPENY OS Supabase Schema
-- Run this in your Supabase SQL editor to create all required tables and storage.

-- Clients
create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  phone       text,
  website     text,
  industry    text,
  status      text not null default 'active' check (status in ('active','inactive','prospect')),
  logo        text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Tasks
create table if not exists tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  status      text not null default 'todo' check (status in ('todo','in_progress','done','overdue')),
  priority    text not null default 'medium' check (priority in ('low','medium','high')),
  due_date    date,
  client_id   uuid references clients(id) on delete set null,
  assigned_to text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Content Items
create table if not exists content_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  platform      text not null,
  status        text not null default 'draft' check (status in ('draft','scheduled','published')),
  schedule_date date,
  client_id     uuid references clients(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Assets
create table if not exists assets (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  file_path          text,
  file_url           text not null,
  file_type          text,
  file_size          bigint,
  bucket_name        text,
  client_id          uuid references clients(id) on delete set null,
  storage_provider   text not null default 'supabase',
  drive_file_id      text,
  drive_folder_id    text,
  view_url           text,
  download_url       text,
  content_type       text check (content_type is null or content_type in (
                       'SOCIAL_POSTS','REELS','VIDEOS','LOGOS','BRAND_ASSETS',
                       'PASSWORDS','DOCUMENTS','RAW_FILES','ADS_CREATIVES','REPORTS','OTHER'
                     )),
  month_key          text check (month_key is null or month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  client_folder_name text,
  -- Drive / content organisation columns (added by supabase-migration-drive-structure.sql)
  client_name        text,
  uploaded_by        text,
  -- Preview / thumbnail metadata (added by supabase-migration-asset-preview.sql)
  mime_type          text,
  preview_url        text,
  thumbnail_url      text,
  web_view_link      text,
  -- Approval workflow columns (added by supabase-migration-saas-v1.sql)
  publish_date       date,
  approval_notes     text,
  approval_status    text default 'pending' check (approval_status is null or approval_status in (
                       'pending','approved','rejected','scheduled','published'
                     )),
  -- Task link (added by supabase-migration-agency-v1.sql)
  task_id            uuid references tasks(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- Approvals
create table if not exists approvals (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  client_id  uuid references clients(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activities
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  type        text not null,
  description text not null,
  user_id     text,
  client_id   uuid references clients(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Storage bucket: client-assets
-- Create this in Supabase Dashboard > Storage, or via SQL:
-- insert into storage.buckets (id, name, public) values ('client-assets', 'client-assets', true)
-- on conflict do nothing;

-- Row Level Security (RLS) — enable and allow all for anon key (adjust as needed for your auth setup)
alter table clients     enable row level security;
alter table tasks       enable row level security;
alter table content_items enable row level security;
alter table assets      enable row level security;
alter table approvals   enable row level security;
alter table activities  enable row level security;

-- Open policies (use only during development; restrict per user in production)
create policy "allow all clients"       on clients       for all using (true) with check (true);
create policy "allow all tasks"         on tasks         for all using (true) with check (true);
create policy "allow all content_items" on content_items for all using (true) with check (true);
create policy "allow all assets"        on assets        for all using (true) with check (true);
create policy "allow all approvals"     on approvals     for all using (true) with check (true);
create policy "allow all activities"    on activities    for all using (true) with check (true);

-- Storage policy for client-assets bucket
create policy "allow all storage"
  on storage.objects for all
  using (bucket_id = 'client-assets')
  with check (bucket_id = 'client-assets');
