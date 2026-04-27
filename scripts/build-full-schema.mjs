#!/usr/bin/env node
/**
 * Builds supabase/full-schema.sql from all files in supabase/migrations/
 * sorted lexicographically (same order as `supabase db push` / migration history by filename).
 */
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const OUT_SQL = join(ROOT, 'supabase', 'full-schema.sql');
const OUT_MD = join(ROOT, 'supabase', 'schema-summary.md');

const REQUIRED_TABLES = [
  'profiles',
  'workspaces',
  'workspace_members',
  'workspace_memberships',
  'workspace_invitations',
  'team_members',
  'team_invitations',
  'member_permissions',
  'user_sessions',
  'clients',
  'projects',
  'tasks',
  'content_items',
  'assets',
  'publishing_schedules',
  'calendar_events',
  'activities',
  'comments',
  'notifications',
  'docs_invoices',
  'docs_invoice_branches',
  'docs_invoice_platforms',
  'docs_invoice_rows',
  'docs_quotations',
  'docs_client_contracts',
  'docs_hr_contracts',
  'docs_employees',
  'docs_salary_adjustments',
  'docs_accounting_entries',
  'docs_accounting_expenses',
  'automation_rules',
  'automation_runs',
  'workspace_automation_settings',
  'recurring_task_schedules',
];

async function main() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  const sqlFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.sql'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));

  const header = `-- =============================================================================
-- OPENY OS — consolidated database schema
-- Generated: ${new Date().toISOString()}
-- Source: ${sqlFiles.length} files under supabase/migrations/ (lexicographic order = Supabase CLI migration order)
--
-- Run on a new Supabase project at your own risk: review RLS, grants, and storage
-- policies for your environment. Prefer supabase db push for incremental history.
-- =============================================================================

-- Canonical extensions (migrations also reference pgcrypto; duplicates below are commented)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

`;

  const blocks = [];
  let combinedForStats = '';

  for (const name of sqlFiles) {
    const path = join(MIGRATIONS_DIR, name);
    let text = await readFile(path, 'utf8');
    text = text.replace(/\r\n/g, '\n');
    blocks.push(`\n-- >>> BEGIN: ${name}\n${text.trimEnd()}\n-- <<< END: ${name}\n`);
    combinedForStats += text + '\n';
  }

  let body = blocks.join('\n');

  // All in-body pgcrypto extension creates → comment (already in header)
  body = body.replace(
    /^CREATE EXTENSION IF NOT EXISTS pgcrypto\s*;\s*$/gim,
    (m) => `-- (consolidated at top) ${m.trim()}`,
  );

  const verification = `

-- =============================================================================
-- VERIFICATION (run manually in SQL Editor)
-- =============================================================================
-- List public tables:
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_type = 'BASE TABLE'
-- ORDER BY table_name;
--
-- content_items columns (expect platform_targets as text[] with default):
-- SELECT column_name, data_type, udt_name, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'content_items'
-- ORDER BY ordinal_position;
--
-- RLS enabled on a table:
-- SELECT relname, relrowsecurity
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public' AND relkind = 'r'
-- ORDER BY relname;
`;

  const fullSql = header + body + verification;
  await mkdir(join(ROOT, 'supabase'), { recursive: true });
  await writeFile(OUT_SQL, fullSql, 'utf8');

  const countMatches = (re, flags = 'gim') => {
    const m = combinedForStats.match(new RegExp(re.source, flags));
    return m ? m.length : 0;
  };

  const createTableCount = countMatches(/^\s*create\s+table\s+(if\s+not\s+exists\s+)?/i);
  const createIndexCount = countMatches(/^\s*create\s+(unique\s+)?index\s+/i);
  const createPolicyCount = countMatches(/^\s*create\s+policy\s+/i);

  const missing = REQUIRED_TABLES.filter((t) => {
    const re = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?${t}\\b`, 'i');
    return !re.test(combinedForStats);
  });

  const hasPlatformTargets = /platform_targets\s+text\[\]/i.test(combinedForStats);
  const hasPlatformDefault =
    /platform_targets\s+text\[\][^;]*default\s+'\{\}'/i.test(combinedForStats) ||
    /platform_targets\s+TEXT\[\][^;]*DEFAULT\s+'\{\}'/i.test(combinedForStats);

  const md = `# OPENY OS — schema summary (generated)

- **Generated at:** ${new Date().toISOString()}
- **Migration files merged:** ${sqlFiles.length}
- **Output:** \`supabase/full-schema.sql\`

## Counts (approximate, regex over merged migration text)

| Metric | Count |
|--------|-------|
| CREATE TABLE statements (lines) | ${createTableCount} |
| CREATE INDEX statements (lines) | ${createIndexCount} |
| CREATE POLICY statements (lines) | ${createPolicyCount} |

> Note: counts include idempotent re-statements across files (e.g. multiple \`CREATE TABLE IF NOT EXISTS\` for the same table). At execution time Postgres skips no-op creates.

## Required tables checklist

${
  missing.length === 0
    ? 'All listed required tables appear in at least one `CREATE TABLE` across migrations.'
    : `**Missing from CREATE TABLE scan:** ${missing.map((m) => `\`${m}\``).join(', ')}`
}

## content_items.platform_targets

- **Column present as \`text[]\`:** ${hasPlatformTargets ? 'yes' : '**no**'}
- **Default \`'{}'\` present in ALTER/CREATE text:** ${hasPlatformDefault ? 'yes' : '**no**'}

Sources: \`supabase-migration-schema-v2.sql\`, \`20260427_content_items_platform_targets_guard.sql\`, and base \`supabase-schema.sql\` (end of chain).

## Tables by module (from migration filenames + table names)

| Module | Tables / areas |
|--------|------------------|
| Core / CRM | clients, projects, tasks, content_items, assets, activities, comments, calendar_events, publishing_schedules |
| Workspace / auth bridge | workspaces, workspace_members, workspace_memberships, workspace_invitations, profiles, user_sessions |
| Team | team_members, team_invitations, member_permissions |
| Notifications | notifications, notification_preferences, notification_delivery_logs, scheduled_reminders, email_logs |
| DOCS | docs_invoices (+ branches/platforms/rows), docs_quotations, docs_client_contracts, docs_hr_contracts, docs_employees, docs_salary_adjustments, docs_accounting_*, docs_backups, docs_client_document_profiles |
| Automation | automation_rules, automation_runs, workspace_automation_settings, recurring_task_schedules |
| Platform extras | templates, tags, notes, time_entries, entity_links, task_asset_links, ai_sessions, ai_actions, workspace_events, stored_files, drive_sync_logs, google_oauth_tokens, … |

## Extensions

- \`supabase/full-schema.sql\` opens with a single **\`CREATE EXTENSION IF NOT EXISTS pgcrypto\`**; identical lines inside merged migrations are commented as \`(consolidated at top)\`.

## Merge assumptions & conflicts

1. **Order:** Files are merged in **strict lexicographic filename order** (same as Supabase CLI when migrations are applied by name). Notably, \`supabase-schema.sql\` sorts **last** (after all \`supabase-migration-*.sql\`), matching the repo’s on-disk naming—not necessarily “base schema first”.
2. **Duplicate CREATE TABLE IF NOT EXISTS:** Several tables are defined in more than one migration (e.g. \`team_members\`, \`team_invitations\`, \`workspace_invitations\`, \`notifications\`, \`profiles\`, \`projects\`, \`docs_invoices\`). This is intentional evolution; \`IF NOT EXISTS\` makes re-runs safe.
3. **pgcrypto:** In-body duplicates are commented; see **Extensions** above.
4. **RLS:** Policies are evolved with \`DROP POLICY IF EXISTS\` in several migrations; full chronological order is preserved.
5. **No semantic SQL parser:** This file is a **concatenation** (plus extension dedupe), not a full AST merge. “Obsolete” migrations are **not** removed, to avoid dropping security or column history the app may still rely on.

## File list (merge order)

${sqlFiles.map((f) => `- \`${f}\``).join('\n')}
`;

  await writeFile(OUT_MD, md, 'utf8');

  if (missing.length) {
    console.error('Required tables missing from merged SQL:', missing);
    process.exitCode = 1;
  }
  if (!hasPlatformTargets) {
    console.error('platform_targets text[] not found in merged migrations');
    process.exitCode = 1;
  }
  console.log('Wrote', OUT_SQL);
  console.log('Wrote', OUT_MD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
