-- OPENY OS — Google OAuth token storage
-- Run this once in your Supabase SQL editor.
--
-- Stores the Google Drive refresh token so it survives re-deploys and can be
-- updated at runtime via /api/google/callback without touching env vars.
-- Only one row is ever stored (key = 'default').

create table if not exists google_oauth_tokens (
  key          text primary key default 'default',
  refresh_token text not null,
  obtained_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Disable Row Level Security — this table is only accessed server-side via the
-- service-role key.  No client-side access is ever granted.
alter table google_oauth_tokens disable row level security;

-- Optional: auto-update updated_at on every write (requires moddatetime extension).
-- comment out the next two lines if you haven't enabled the extension.
-- create extension if not exists moddatetime schema extensions;
-- create trigger handle_updated_at before update on google_oauth_tokens
--   for each row execute procedure moddatetime(updated_at);
