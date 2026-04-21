alter table if exists public.docs_invoices
  add column if not exists invoice_template text default 'Manual';

update public.docs_invoices
set invoice_template = 'Manual'
where invoice_template is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'docs_invoices_invoice_template_check'
  ) then
    alter table if exists public.docs_invoices
      add constraint docs_invoices_invoice_template_check
      check (invoice_template in ('Manual', 'Pro icon KSA Template'));
  end if;
end
$$;
