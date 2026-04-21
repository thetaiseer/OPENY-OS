-- ============================================================
-- OPENY — Supabase Database Schema
-- ============================================================
-- Run this script once in your Supabase project:
--   Dashboard → SQL Editor → New query → paste → Run
--
-- Invoices and activity_logs use dedicated columns.
-- All other tables use a single JSONB `data` column.
--
-- Storage bucket for exported files (PDF / Excel / Word):
--   Dashboard → Storage → New bucket → name: "documents" → Public bucket: ON
-- The app uploads to paths like:  invoices/<timestamp>-<uid>-<filename>
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Invoices (column-based for cross-device querying)
CREATE TABLE IF NOT EXISTS invoices (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT        NOT NULL,
    client_name    TEXT        NOT NULL,
    currency       TEXT        NOT NULL DEFAULT 'EGP',
    total_budget   NUMERIC     NOT NULL DEFAULT 0,
    campaign_month TEXT,
    invoice_date   TEXT,
    status         TEXT        NOT NULL DEFAULT 'draft',
    pdf_url        TEXT,
    excel_url      TEXT,
    form_data      JSONB,
    archived       BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quotations
CREATE TABLE IF NOT EXISTS quotations (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Contracts
CREATE TABLE IF NOT EXISTS client_contracts (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HR Contracts
CREATE TABLE IF NOT EXISTS hr_contracts (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salary History
CREATE TABLE IF NOT EXISTS salary_history (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Logs (column-based for structured querying)
CREATE TABLE IF NOT EXISTS activity_logs (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    module     TEXT        NOT NULL,
    record_id  UUID        NOT NULL,
    action     TEXT        NOT NULL,
    title      TEXT,
    details    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accounting Ledger
CREATE TABLE IF NOT EXISTS acct_ledger (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounting Expenses
CREATE TABLE IF NOT EXISTS acct_expenses (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy: Client Collections (backward-compatibility only)
CREATE TABLE IF NOT EXISTS acct_client_collections (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy: Egypt Collections (backward-compatibility only)
CREATE TABLE IF NOT EXISTS acct_egypt_collections (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Legacy: Captain Collections (backward-compatibility only)
CREATE TABLE IF NOT EXISTS acct_captain_collections (
    id         TEXT        PRIMARY KEY,
    data       JSONB       NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row-Level Security for invoices and activity_logs
-- Allows anonymous access (anon role) so the app can read
-- and write without authentication. Tighten these policies
-- once you add user authentication to the app.
-- ============================================================
ALTER TABLE invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_allow_all" ON invoices;
CREATE POLICY "invoices_allow_all"
ON invoices FOR ALL TO anon
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "logs_allow_all" ON activity_logs;
CREATE POLICY "logs_allow_all"
ON activity_logs FOR ALL TO anon
USING (true) WITH CHECK (true);

-- ============================================================
-- Optional: Row-Level Security for other tables
-- Uncomment after confirming the app works, then add policies
-- that match your auth setup.
-- ============================================================
-- ALTER TABLE quotations            ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE client_contracts      ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE hr_contracts          ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees             ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE salary_history        ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE acct_ledger           ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE acct_expenses         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE acct_client_collections   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE acct_egypt_collections    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE acct_captain_collections  ENABLE ROW LEVEL SECURITY;
