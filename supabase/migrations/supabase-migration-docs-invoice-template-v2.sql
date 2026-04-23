alter table if exists public.docs_invoices
  add column if not exists invoice_template text default 'Manual';

update public.docs_invoices
set invoice_template = 'Manual'
where invoice_template is null;

alter table if exists public.docs_invoices
  drop constraint if exists docs_invoices_invoice_template_check;

alter table if exists public.docs_invoices
  add constraint docs_invoices_invoice_template_check
  check (
    invoice_template in (
      'Manual',
      'Pro icon KSA Template',
      'Pro icon UAE Template',
      'Pro icon Global Template',
      'SAMA Travel Template'
    )
  );
