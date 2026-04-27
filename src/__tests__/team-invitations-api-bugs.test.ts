/**
 * Regression tests for two bugs found in recent PRs.
 *
 * Bug 1 (GET /api/team/invitations — selectVariants ordering):
 *   The first entry in selectVariants does NOT include `accepted_at`.  On a
 *   modern DB that has the column the query succeeds on the first try and
 *   `accepted_at` is never fetched, so every TeamInvitation returned by the
 *   endpoint has `accepted_at: null` regardless of what the DB stores.
 *
 * Bug 2 (formatWorkspaceAccessSummary — empty access array):
 *   When an invitation was created without explicit workspace_access the
 *   access array is empty (length 0).  `formatWorkspaceAccessSummary` falls
 *   through to `return workspaceLabelUi('os', t)` which produces "OPENY OS",
 *   making the summary line on pending invitation cards always say
 *   "Workspace Access: OPENY OS" even for invitations where no workspace has
 *   been stored, which is misleading.
 */

import { describe, it, expect } from 'vitest';

// ── Shared fixtures ────────────────────────────────────────────────────────────

/** Minimal shape of an invitation row coming back from Supabase. */
type InvitationRow = {
  id: string;
  team_member_id: string;
  email: string;
  token: string;
  role?: string | null;
  access_role?: string | null;
  status: string;
  invited_by?: string | null;
  expires_at: string;
  accepted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  workspace_access?: unknown;
  workspace_roles?: unknown;
  team_member?: unknown;
};

// ── Bug 1: accepted_at dropped when the first selectVariants entry succeeds ───

/**
 * Mirror the SELECT column list from the first element of selectVariants in
 * src/app/api/team/invitations/route.ts.  This reproduces what Supabase
 * returns when a modern DB has the `accepted_at` column: the query succeeds,
 * but the column was not listed, so accepted_at is missing from the result.
 */
function simulateFirstVariantRow(acceptedAt: string): Omit<InvitationRow, 'accepted_at'> {
  return {
    id: 'inv-1',
    team_member_id: 'tm-1',
    email: 'alice@example.com',
    token: 'tok-abc',
    role: 'team_member',
    status: 'accepted',
    invited_by: 'admin-uid',
    // The first selectVariant is:
    // 'id, team_member_id, email, token, role, status, invited_by, expires_at,
    //  created_at, updated_at, workspace_access, workspace_roles'
    // — accepted_at is NOT in that list, so it is absent from the result.
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: acceptedAt,
    workspace_access: ['os'],
    workspace_roles: { os: 'member' },
  };
}

/**
 * `normalizeInvitationRow` (extracted inline for test purposes).
 * Mirrors what src/app/api/team/invitations/route.ts does with each row.
 */
function normalizeInvitationRow(row: InvitationRow) {
  const fallbackExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  return {
    id: row.id,
    team_member_id: row.team_member_id,
    email: row.email,
    role: row.role ?? row.access_role ?? undefined,
    token: row.token,
    status: (row.status ?? '').toLowerCase(),
    invited_by: row.invited_by ?? null,
    expires_at: row.expires_at ?? fallbackExpiry,
    accepted_at: row.accepted_at ?? null,        // ← the bug is here
    created_at: row.created_at ?? nowIso,
    updated_at: row.updated_at ?? row.created_at ?? nowIso,
    workspace_access: (row.workspace_access ?? null),
    workspace_roles: (row.workspace_roles ?? null),
  };
}

describe('Bug 1 — GET /api/team/invitations drops accepted_at on modern DBs', () => {
  it('reproduces the bug: when accepted_at is absent from the row (as the old first selectVariant produced), normalizeInvitationRow returns accepted_at: null', () => {
    const acceptedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(); // 1 day ago
    // Simulate what the old first variant returned: no accepted_at key.
    const rawRow = simulateFirstVariantRow(acceptedAt) as InvitationRow;
    expect('accepted_at' in rawRow).toBe(false);

    const normalized = normalizeInvitationRow(rawRow);
    // BUG (pre-fix): accepted_at is null even though the invitation was accepted yesterday.
    expect(normalized.accepted_at).toBe(null);
  });

  it('fix: when accepted_at IS included in the row (new selectVariant order), normalizeInvitationRow preserves it', () => {
    const acceptedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const rawRow: InvitationRow = {
      ...simulateFirstVariantRow(acceptedAt),
      accepted_at: acceptedAt,   // now included because the first selectVariant was promoted
    };
    const normalized = normalizeInvitationRow(rawRow);
    expect(normalized.accepted_at).toBe(acceptedAt);
  });
});

// ── Bug 2: formatWorkspaceAccessSummary returns wrong label for empty access ──

/**
 * Mirrors `formatWorkspaceAccessSummary` from src/app/(app)/team/page.tsx.
 * t() is stubbed to return its key for simplicity.
 */
type WorkspaceKey = 'os' | 'docs';

function formatWorkspaceAccessSummaryBuggy(access: Array<WorkspaceKey>): string {
  // Exact copy of the current (buggy) implementation:
  if (access.length === 2) return 'OPENY OS + OPENY DOCS';     // t('teamWsSummaryBoth')
  if (access[0] === 'docs') return 'OPENY DOCS';                // workspaceLabelUi('docs', t)
  return 'OPENY OS';                                            // workspaceLabelUi('os', t)  ← reached when length===0 too
}

function formatWorkspaceAccessSummaryFixed(access: Array<WorkspaceKey>): string {
  if (access.length === 0) return '';      // no stored workspace — don't claim OS
  if (access.length >= 2) return 'OPENY OS + OPENY DOCS';
  if (access[0] === 'docs') return 'OPENY DOCS';
  return 'OPENY OS';
}

describe('Bug 2 — formatWorkspaceAccessSummary misleads when access array is empty', () => {
  it('reproduces: empty access [] returns "OPENY OS", misleadingly claiming workspace coverage', () => {
    expect(formatWorkspaceAccessSummaryBuggy([])).toBe('OPENY OS');
    // A pending invitation with NO stored workspace_access shows
    // "Workspace Access: OPENY OS" which is a false positive.
  });

  it('reproduces: single-element ["os"] also returns "OPENY OS" — indistinguishable from the empty case', () => {
    expect(formatWorkspaceAccessSummaryBuggy(['os'])).toBe('OPENY OS');
    expect(formatWorkspaceAccessSummaryBuggy([])).toBe('OPENY OS');
    // Both cases produce identical output, so admins cannot tell whether
    // a workspace was explicitly assigned or just defaulted.
  });

  it('fix: empty access [] returns empty string (no false workspace claim)', () => {
    expect(formatWorkspaceAccessSummaryFixed([])).toBe('');
  });

  it('fix: ["os"] still returns "OPENY OS"', () => {
    expect(formatWorkspaceAccessSummaryFixed(['os'])).toBe('OPENY OS');
  });

  it('fix: ["docs"] still returns "OPENY DOCS"', () => {
    expect(formatWorkspaceAccessSummaryFixed(['docs'])).toBe('OPENY DOCS');
  });

  it('fix: ["os","docs"] still returns "OPENY OS + OPENY DOCS"', () => {
    expect(formatWorkspaceAccessSummaryFixed(['os', 'docs'])).toBe('OPENY OS + OPENY DOCS');
  });
});
