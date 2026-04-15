alter table if exists public.docs_invoices
  add column if not exists branch_groups jsonb default '[]'::jsonb;

alter table if exists public.docs_invoices
  add column if not exists final_budget numeric(14,2);

alter table if exists public.docs_invoices
  add column if not exists our_fees numeric(14,2);

alter table if exists public.docs_invoices
  add column if not exists grand_total numeric(14,2);

update public.docs_invoices
set final_budget = total_budget
where final_budget is null;

update public.docs_invoices
set grand_total = coalesce(total_budget, 0) + coalesce(our_fees, 0)
where grand_total is null;

alter table if exists public.docs_invoices
  alter column final_budget set default 0;

alter table if exists public.docs_invoices
  alter column our_fees set default 0;

alter table if exists public.docs_invoices
  alter column grand_total set default 0;
