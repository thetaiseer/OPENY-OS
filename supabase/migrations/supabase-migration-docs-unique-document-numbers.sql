-- One sequence per document type; enforced at DB level so concurrent creates cannot collide.

CREATE UNIQUE INDEX IF NOT EXISTS docs_invoices_invoice_number_key
  ON public.docs_invoices (invoice_number);

CREATE UNIQUE INDEX IF NOT EXISTS docs_quotations_quote_number_key
  ON public.docs_quotations (quote_number);

CREATE UNIQUE INDEX IF NOT EXISTS docs_client_contracts_contract_number_key
  ON public.docs_client_contracts (contract_number);

CREATE UNIQUE INDEX IF NOT EXISTS docs_hr_contracts_contract_number_key
  ON public.docs_hr_contracts (contract_number);
