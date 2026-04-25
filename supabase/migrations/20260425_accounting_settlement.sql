-- Partner settlement: who paid each expense, inter-partner transfers, month notes

ALTER TABLE docs_accounting_expenses
  ADD COLUMN IF NOT EXISTS paid_by_partner TEXT;

CREATE TABLE IF NOT EXISTS docs_accounting_transfers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month_key       TEXT NOT NULL,
  from_partner    TEXT NOT NULL,
  to_partner      TEXT NOT NULL,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'SAR',
  transfer_date   DATE DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_docs_accounting_transfers_month
  ON docs_accounting_transfers(month_key);

CREATE TABLE IF NOT EXISTS docs_accounting_month_meta (
  month_key   TEXT PRIMARY KEY,
  notes       TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER docs_accounting_transfers_updated_at
  BEFORE UPDATE ON docs_accounting_transfers
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

CREATE TRIGGER docs_accounting_month_meta_updated_at
  BEFORE UPDATE ON docs_accounting_month_meta
  FOR EACH ROW EXECUTE FUNCTION docs_set_updated_at();

ALTER TABLE docs_accounting_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_accounting_transfers_auth"
  ON docs_accounting_transfers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE docs_accounting_month_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs_accounting_month_meta_auth"
  ON docs_accounting_month_meta FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
