-- Ensure invoice root table exists in public schema.
create table if not exists public.docs_invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text not null,
  client_name      text not null,
  campaign_month   text,
  invoice_date     date,
  total_budget     numeric(14,2) default 0,
  final_budget     numeric(14,2) default 0,
  our_fees         numeric(14,2) default 0,
  grand_total      numeric(14,2) default 0,
  currency         text default 'SAR',
  status           text default 'unpaid',
  branch_groups    jsonb default '[]'::jsonb,
  platforms        jsonb default '[]'::jsonb,
  deliverables     jsonb default '[]'::jsonb,
  custom_client    text,
  custom_project   text,
  notes            text,
  export_pdf_url   text,
  export_excel_url text,
  is_duplicate     boolean default false,
  original_id      uuid,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table if exists public.docs_invoices
  alter column branch_groups set default '[]'::jsonb;

-- Normalized nested structure: Invoice -> Branches -> Platforms -> Rows
create table if not exists public.docs_invoice_branches (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.docs_invoices(id) on delete cascade,
  branch_name text not null default 'Branch',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.docs_invoice_platforms (
  id            uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references public.docs_invoice_branches(id) on delete cascade,
  platform_name  text not null default 'Platform',
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.docs_invoice_rows (
  id          uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.docs_invoice_platforms(id) on delete cascade,
  ad_name     text not null default '',
  date        date,
  results     text,
  cost        numeric(14,2) not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_docs_invoice_branches_invoice on public.docs_invoice_branches(invoice_id, position);
create index if not exists idx_docs_invoice_platforms_branch on public.docs_invoice_platforms(branch_id, position);
create index if not exists idx_docs_invoice_rows_platform on public.docs_invoice_rows(platform_id, position);

create or replace function public.docs_invoice_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists docs_invoice_branches_updated_at on public.docs_invoice_branches;
create trigger docs_invoice_branches_updated_at
before update on public.docs_invoice_branches
for each row execute function public.docs_invoice_set_updated_at();

drop trigger if exists docs_invoice_platforms_updated_at on public.docs_invoice_platforms;
create trigger docs_invoice_platforms_updated_at
before update on public.docs_invoice_platforms
for each row execute function public.docs_invoice_set_updated_at();

drop trigger if exists docs_invoice_rows_updated_at on public.docs_invoice_rows;
create trigger docs_invoice_rows_updated_at
before update on public.docs_invoice_rows
for each row execute function public.docs_invoice_set_updated_at();

alter table if exists public.docs_invoice_branches enable row level security;
alter table if exists public.docs_invoice_platforms enable row level security;
alter table if exists public.docs_invoice_rows enable row level security;

drop policy if exists "docs_invoice_branches_auth" on public.docs_invoice_branches;
create policy "docs_invoice_branches_auth"
on public.docs_invoice_branches
for all
to authenticated
using (true)
with check (true);

drop policy if exists "docs_invoice_platforms_auth" on public.docs_invoice_platforms;
create policy "docs_invoice_platforms_auth"
on public.docs_invoice_platforms
for all
to authenticated
using (true)
with check (true);

drop policy if exists "docs_invoice_rows_auth" on public.docs_invoice_rows;
create policy "docs_invoice_rows_auth"
on public.docs_invoice_rows
for all
to authenticated
using (true)
with check (true);

-- Force PostgREST (Supabase API) schema cache refresh.
select pg_notify('pgrst', 'reload schema');
