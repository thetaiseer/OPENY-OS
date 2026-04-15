-- ============================================================
-- OPENY DOCS — Client Document Profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS docs_client_document_profiles (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                  UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE UNIQUE,
  default_currency           TEXT NOT NULL DEFAULT 'SAR',
  invoice_type               TEXT,
  quotation_type             TEXT,
  contract_type              TEXT,
  default_template_style     TEXT,
  billing_address            TEXT,
  tax_info                   TEXT,
  notes                      TEXT,
  invoice_layout_mode        TEXT NOT NULL DEFAULT 'branch_platform',
  supports_branch_breakdown  BOOLEAN NOT NULL DEFAULT TRUE,
  default_platforms          JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_branch_names       JSONB NOT NULL DEFAULT '[]'::jsonb,
  service_description_default TEXT,
  default_fees_logic         JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_totals_logic       JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice_template_config    JSONB NOT NULL DEFAULT '{}'::jsonb,
  quotation_template_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  contract_template_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  hr_contract_template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  employees_template_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  accounting_template_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_client_profiles_client_id
  ON docs_client_document_profiles(client_id);

ALTER TABLE docs_client_document_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'docs_client_document_profiles'
      AND policyname = 'docs_client_profiles_auth'
  ) THEN
    CREATE POLICY "docs_client_profiles_auth"
      ON docs_client_document_profiles
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'docs_client_profiles_updated_at'
  ) THEN
    CREATE TRIGGER docs_client_profiles_updated_at
      BEFORE UPDATE ON docs_client_document_profiles
      FOR EACH ROW
      EXECUTE FUNCTION docs_set_updated_at();
  END IF;
END $$;

ALTER TABLE docs_invoices ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_quotations ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_client_contracts ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_hr_contracts ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_employees ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
ALTER TABLE docs_accounting_entries ADD COLUMN IF NOT EXISTS client_profile_id UUID REFERENCES docs_client_document_profiles(id) ON DELETE SET NULL;
