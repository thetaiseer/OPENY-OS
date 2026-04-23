-- ============================================================
-- OPENY DOCS Migration
-- All tables for the OPENY DOCS subsystem
-- Run AFTER the base supabase-schema.sql migrations.
-- ============================================================

-- ── Invoices ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_invoices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number  TEXT NOT NULL,
  client_name     TEXT NOT NULL,
  campaign_month  TEXT,
  invoice_date    DATE,
  total_budget    NUMERIC(14,2) DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  status          TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  platforms       JSONB DEFAULT '[]',
  deliverables    JSONB DEFAULT '[]',
  custom_client   TEXT,
  custom_project  TEXT,
  notes           TEXT,
  export_pdf_url  TEXT,
  export_excel_url TEXT,
  is_duplicate    BOOLEAN DEFAULT FALSE,
  original_id     UUID,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Quotations ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_quotations (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number          TEXT NOT NULL,
  quote_date            DATE,
  currency              TEXT DEFAULT 'SAR',
  client_name           TEXT NOT NULL,
  company_brand         TEXT,
  project_title         TEXT,
  project_description   TEXT,
  deliverables          JSONB DEFAULT '[]',
  total_value           NUMERIC(14,2) DEFAULT 0,
  payment_due_days      INTEGER DEFAULT 30,
  payment_method        TEXT,
  custom_payment_method TEXT,
  additional_notes      TEXT,
  status                TEXT DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid')),
  export_pdf_url        TEXT,
  export_excel_url      TEXT,
  is_duplicate          BOOLEAN DEFAULT FALSE,
  original_id           UUID,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── Client Contracts ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_client_contracts (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number       TEXT NOT NULL,
  contract_date         DATE,
  duration_months       INTEGER DEFAULT 12,
  status                TEXT DEFAULT 'draft',
  currency              TEXT DEFAULT 'SAR',
  language              TEXT DEFAULT 'en' CHECK (language IN ('ar', 'en')),
  party1_company_name   TEXT,
  party1_representative TEXT,
  party1_address        TEXT,
  party1_email          TEXT,
  party1_phone          TEXT,
  party1_website        TEXT,
  party1_tax_reg        TEXT,
  party2_client_name    TEXT,
  party2_contact_person TEXT,
  party2_address        TEXT,
  party2_email          TEXT,
  party2_phone          TEXT,
  party2_website        TEXT,
  party2_tax_reg        TEXT,
  services              JSONB DEFAULT '[]',
  total_value           NUMERIC(14,2) DEFAULT 0,
  payment_method        TEXT,
  payment_terms         TEXT,
  notes                 TEXT,
  legal_clauses         JSONB DEFAULT '[]',
  sig_party1            TEXT,
  sig_party2            TEXT,
  sig_date              DATE,
  sig_place             TEXT,
  export_pdf_url        TEXT,
  export_doc_url        TEXT,
  is_duplicate          BOOLEAN DEFAULT FALSE,
  original_id           UUID,
  created_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── HR Contracts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_hr_contracts (
  id                     UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_number        TEXT NOT NULL,
  contract_date          DATE,
  duration               TEXT,
  status                 TEXT DEFAULT 'draft',
  currency               TEXT DEFAULT 'SAR',
  language               TEXT DEFAULT 'en' CHECK (language IN ('ar', 'en')),
  company_name           TEXT,
  company_representative TEXT,
  company_address        TEXT,
  company_email          TEXT,
  company_phone          TEXT,
  employee_full_name     TEXT NOT NULL,
  employee_national_id   TEXT,
  employee_address       TEXT,
  employee_phone         TEXT,
  employee_email         TEXT,
  employee_nationality   TEXT,
  employee_marital_status TEXT,
  job_title              TEXT,
  department             TEXT,
  direct_manager         TEXT,
  employment_type        TEXT,
  start_date             DATE,
  contract_duration      TEXT,
  probation_period       TEXT,
  workplace              TEXT,
  salary                 NUMERIC(14,2) DEFAULT 0,
  payment_method         TEXT,
  payment_date           TEXT,
  benefits               JSONB DEFAULT '[]',
  daily_hours            NUMERIC(5,2) DEFAULT 8,
  work_days              TEXT,
  annual_leave           INTEGER DEFAULT 21,
  legal_clauses          JSONB DEFAULT '[]',
  sig_company_rep        TEXT,
  sig_employee_name      TEXT,
  sig_date               DATE,
  sig_place              TEXT,
  export_pdf_url         TEXT,
  export_doc_url         TEXT,
  is_duplicate           BOOLEAN DEFAULT FALSE,
  original_id            UUID,
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── Employees ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_employees (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id       TEXT UNIQUE NOT NULL,
  full_name         TEXT NOT NULL,
  date_of_birth     DATE,
  phone             TEXT,
  address           TEXT,
  job_title         TEXT,
  employment_type   TEXT DEFAULT 'full_time',
  hire_date         DATE,
  status            TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  daily_hours       NUMERIC(5,2) DEFAULT 8,
  contract_duration TEXT,
  salary            NUMERIC(14,2) DEFAULT 0,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── Salary Adjustments ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_salary_adjustments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id   UUID NOT NULL REFERENCES docs_employees(id) ON DELETE CASCADE,
  new_salary    NUMERIC(14,2) NOT NULL,
  change_amount NUMERIC(14,2),
  change_type   TEXT CHECK (change_type IN ('increase', 'decrease', 'initial')),
  effective_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Accounting Entries (Clients Ledger) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_accounting_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name     TEXT NOT NULL,
  service         TEXT,
  amount          NUMERIC(14,2) DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  collection_type TEXT DEFAULT 'local' CHECK (collection_type IN ('local', 'overseas')),
  collector       TEXT,
  entry_date      DATE DEFAULT CURRENT_DATE,
  month_key       TEXT NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Accounting Expenses ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_accounting_expenses (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  description  TEXT NOT NULL,
  amount       NUMERIC(14,2) DEFAULT 0,
  currency     TEXT DEFAULT 'SAR',
  expense_date DATE DEFAULT CURRENT_DATE,
  month_key    TEXT NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Document Backups ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs_backups (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module     TEXT NOT NULL CHECK (module IN ('invoices','quotations','client_contracts','hr_contracts','employees','accounting')),
  label      TEXT,
  data       JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_docs_invoices_status      ON docs_invoices(status);
CREATE INDEX IF NOT EXISTS idx_docs_invoices_client_name ON docs_invoices(client_name);
CREATE INDEX IF NOT EXISTS idx_docs_invoices_date        ON docs_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_docs_invoices_created_at  ON docs_invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_quotations_status      ON docs_quotations(status);
CREATE INDEX IF NOT EXISTS idx_docs_quotations_client_name ON docs_quotations(client_name);
CREATE INDEX IF NOT EXISTS idx_docs_quotations_created_at  ON docs_quotations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_client_contracts_status     ON docs_client_contracts(status);
CREATE INDEX IF NOT EXISTS idx_docs_client_contracts_created_at ON docs_client_contracts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_hr_contracts_status        ON docs_hr_contracts(status);
CREATE INDEX IF NOT EXISTS idx_docs_hr_contracts_employee_name ON docs_hr_contracts(employee_full_name);
CREATE INDEX IF NOT EXISTS idx_docs_hr_contracts_created_at    ON docs_hr_contracts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_docs_employees_status          ON docs_employees(status);
CREATE INDEX IF NOT EXISTS idx_docs_employees_employment_type ON docs_employees(employment_type);

CREATE INDEX IF NOT EXISTS idx_docs_salary_adjustments_employee ON docs_salary_adjustments(employee_id);
CREATE INDEX IF NOT EXISTS idx_docs_salary_adjustments_date     ON docs_salary_adjustments(effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_docs_accounting_entries_month    ON docs_accounting_entries(month_key);
CREATE INDEX IF NOT EXISTS idx_docs_accounting_entries_collector ON docs_accounting_entries(collector);

CREATE INDEX IF NOT EXISTS idx_docs_accounting_expenses_month   ON docs_accounting_expenses(month_key);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE docs_invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_quotations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_client_contracts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_hr_contracts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_salary_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_accounting_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE docs_backups            ENABLE ROW LEVEL SECURITY;

-- API routes use service_role key which bypasses RLS.
-- Authenticated users may read/write their workspace data.

CREATE POLICY "docs_invoices_auth"            ON docs_invoices           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_quotations_auth"          ON docs_quotations         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_client_contracts_auth"    ON docs_client_contracts   FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_hr_contracts_auth"        ON docs_hr_contracts       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_employees_auth"           ON docs_employees          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_salary_adjustments_auth"  ON docs_salary_adjustments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_accounting_entries_auth"  ON docs_accounting_entries  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_accounting_expenses_auth" ON docs_accounting_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "docs_backups_auth"             ON docs_backups            FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION docs_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER docs_invoices_updated_at
  BEFORE UPDATE ON docs_invoices
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_quotations_updated_at
  BEFORE UPDATE ON docs_quotations
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_client_contracts_updated_at
  BEFORE UPDATE ON docs_client_contracts
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_hr_contracts_updated_at
  BEFORE UPDATE ON docs_hr_contracts
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_employees_updated_at
  BEFORE UPDATE ON docs_employees
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_accounting_entries_updated_at
  BEFORE UPDATE ON docs_accounting_entries
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_accounting_expenses_updated_at
  BEFORE UPDATE ON docs_accounting_expenses
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();
