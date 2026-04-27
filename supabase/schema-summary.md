# OPENY OS — schema summary (generated)

- **Generated at:** 2026-04-27T18:11:32.379Z
- **Migration files merged:** 70
- **Output:** `supabase/full-schema.sql`

## Counts (approximate, regex over merged migration text)

| Metric | Count |
|--------|-------|
| CREATE TABLE statements (lines) | 77 |
| CREATE INDEX statements (lines) | 250 |
| CREATE POLICY statements (lines) | 162 |

> Note: counts include idempotent re-statements across files (e.g. multiple `CREATE TABLE IF NOT EXISTS` for the same table). At execution time Postgres skips no-op creates.

## Required tables checklist

All listed required tables appear in at least one `CREATE TABLE` across migrations.

## content_items.platform_targets

- **Column present as `text[]`:** yes
- **Default `'{}'` present in ALTER/CREATE text:** yes

Sources: `supabase-migration-schema-v2.sql`, `20260427_content_items_platform_targets_guard.sql`, and base `supabase-schema.sql` (end of chain).

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

- `supabase/full-schema.sql` opens with a single **`CREATE EXTENSION IF NOT EXISTS pgcrypto`**; identical lines inside merged migrations are commented as `(consolidated at top)`.

## Merge assumptions & conflicts

1. **Order:** Files are merged in **strict lexicographic filename order** (same as Supabase CLI when migrations are applied by name). Notably, `supabase-schema.sql` sorts **last** (after all `supabase-migration-*.sql`), matching the repo’s on-disk naming—not necessarily “base schema first”.
2. **Duplicate CREATE TABLE IF NOT EXISTS:** Several tables are defined in more than one migration (e.g. `team_members`, `team_invitations`, `workspace_invitations`, `notifications`, `profiles`, `projects`, `docs_invoices`). This is intentional evolution; `IF NOT EXISTS` makes re-runs safe.
3. **pgcrypto:** In-body duplicates are commented; see **Extensions** above.
4. **RLS:** Policies are evolved with `DROP POLICY IF EXISTS` in several migrations; full chronological order is preserved.
5. **No semantic SQL parser:** This file is a **concatenation** (plus extension dedupe), not a full AST merge. “Obsolete” migrations are **not** removed, to avoid dropping security or column history the app may still rely on.

## File list (merge order)

- `20260425_accounting_settlement.sql`
- `20260425_unified_missing_columns.sql`
- `20260425_user_sessions_missing_columns.sql`
- `20260426_activity_log_v2.sql`
- `20260426_clients_logo_column.sql`
- `20260426_notifications_v3_module_targeting.sql`
- `20260427_content_items_platform_targets_guard.sql`
- `20260427_content_items_rls_workspace_scope.sql`
- `20260427_intelligent_workflow_automations.sql`
- `20260427_operational_indexes.sql`
- `20260427_supabase_perf_rls_indexes.sql`
- `20260427_workspace_invitations_invite_only.sql`
- `20260427_workspace_invitations_rls_invite_only.sql`
- `supabase-migration-admin-role.sql`
- `supabase-migration-advanced.sql`
- `supabase-migration-agency-v1.sql`
- `supabase-migration-asset-previews.sql`
- `supabase-migration-assets-db-save-fix.sql`
- `supabase-migration-assets-upload-fix.sql`
- `supabase-migration-assets-upload-system-fix.sql`
- `supabase-migration-assets-v2.sql`
- `supabase-migration-auth-hardening.sql`
- `supabase-migration-automations.sql`
- `supabase-migration-bidirectional-sync.sql`
- `supabase-migration-docs-client-profiles.sql`
- `supabase-migration-docs-invoice-grouped.sql`
- `supabase-migration-docs-invoice-nested-tables.sql`
- `supabase-migration-docs-invoice-template-v2.sql`
- `supabase-migration-docs-invoice-template.sql`
- `supabase-migration-docs-unique-document-numbers.sql`
- `supabase-migration-docs.sql`
- `supabase-migration-drive-schema-v2.sql`
- `supabase-migration-google-tokens.sql`
- `supabase-migration-invitation-status-fix.sql`
- `supabase-migration-missing-columns.sql`
- `supabase-migration-notification-engine-v1.sql`
- `supabase-migration-notifications-event-driven.sql`
- `supabase-migration-notifications-v2.sql`
- `supabase-migration-performance-indexes.sql`
- `supabase-migration-permissions-v1.sql`
- `supabase-migration-profiles.sql`
- `supabase-migration-publishing-schedules.sql`
- `supabase-migration-r2-clean.sql`
- `supabase-migration-rls-v1.sql`
- `supabase-migration-role-consistency.sql`
- `supabase-migration-saas-v1.sql`
- `supabase-migration-schema-v2.sql`
- `supabase-migration-sessions.sql`
- `supabase-migration-storage-rls.sql`
- `supabase-migration-storage-upload-policy-fix.sql`
- `supabase-migration-sync-logs.sql`
- `supabase-migration-tasks-position.sql`
- `supabase-migration-tasks-v2.sql`
- `supabase-migration-tasks-v3.sql`
- `supabase-migration-team-complete.sql`
- `supabase-migration-team-identity.sql`
- `supabase-migration-team-invitations-accepted-at.sql`
- `supabase-migration-team-invitations.sql`
- `supabase-migration-team-invite-fix.sql`
- `supabase-migration-team-production-repair.sql`
- `supabase-migration-team-schema-fix.sql`
- `supabase-migration-unified-storage-files.sql`
- `supabase-migration-upload-state.sql`
- `supabase-migration-v3-unified-workspace.sql`
- `supabase-migration-workflow-hub.sql`
- `supabase-migration-workspace-members-owner-bootstrap.sql`
- `supabase-migration-workspace-membership-conflict-fix.sql`
- `supabase-migration-workspace-memberships.sql`
- `supabase-migration-workspaces.sql`
- `supabase-schema.sql`
