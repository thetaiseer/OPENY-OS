/**
 * src/lib/permissions.ts
 *
 * Canonical permission resolver for OPENY Platform.
 *
 * Roles:   owner | admin | member
 * Access:  full | read | none
 *
 * Resolution order (highest wins):
 *   1. Owner  → always full access everywhere
 *   2. Admin  → full access everywhere except owner-only actions
 *   3. Member → defaults to read-only; per-member overrides applied on top
 *
 * Usage (client):
 *   const perms = resolveEffectivePermissions(role, overrides);
 *   const ok = hasModuleAccess(perms, 'os', 'clients', 'full');
 *
 * Usage (server):
 *   const perms = await fetchMemberPermissions(db, teamMemberId, role);
 */

import type {
  MemberPermissions,
  MemberPermissionRow,
  ModuleAccess,
  OsModule,
  DocsModule,
  PlatformRole,
} from './types';

// ── Module registry ───────────────────────────────────────────────────────────

export const OS_MODULES: OsModule[] = [
  'dashboard',
  'clients',
  'tasks',
  'content',
  'calendar',
  'assets',
  'reports',
  'team',
  'activity',
  'security',
];

export const DOCS_MODULES: DocsModule[] = ['invoice', 'quotation', 'contracts', 'accounting'];

// ── Role defaults ─────────────────────────────────────────────────────────────

function buildFullOs(): Record<OsModule, ModuleAccess> {
  return Object.fromEntries(OS_MODULES.map((m) => [m, 'full'])) as Record<OsModule, ModuleAccess>;
}

function buildReadOs(): Record<OsModule, ModuleAccess> {
  return Object.fromEntries(OS_MODULES.map((m) => [m, 'read'])) as Record<OsModule, ModuleAccess>;
}

function buildFullDocs(): Record<DocsModule, ModuleAccess> {
  return Object.fromEntries(DOCS_MODULES.map((m) => [m, 'full'])) as Record<
    DocsModule,
    ModuleAccess
  >;
}

function buildReadDocs(): Record<DocsModule, ModuleAccess> {
  return Object.fromEntries(DOCS_MODULES.map((m) => [m, 'read'])) as Record<
    DocsModule,
    ModuleAccess
  >;
}

function buildNoneOs(): Record<OsModule, ModuleAccess> {
  return Object.fromEntries(OS_MODULES.map((m) => [m, 'none'])) as Record<OsModule, ModuleAccess>;
}

function buildNoneDocs(): Record<DocsModule, ModuleAccess> {
  return Object.fromEntries(DOCS_MODULES.map((m) => [m, 'none'])) as Record<
    DocsModule,
    ModuleAccess
  >;
}

/** Default permission matrix for each platform role */
export const ROLE_DEFAULTS: Record<PlatformRole, Omit<MemberPermissions, 'role'>> = {
  owner: {
    os: buildFullOs(),
    docs: buildFullDocs(),
  },
  admin: {
    os: buildFullOs(),
    docs: buildFullDocs(),
  },
  member: {
    os: buildReadOs(),
    docs: buildReadDocs(),
  },
};

// ── Resolve effective permissions ─────────────────────────────────────────────

/**
 * Compute a member's effective permissions by merging role defaults with
 * their stored per-module overrides.  Overrides can only lower access
 * (owner/admin bypass all overrides).
 */
export function resolveEffectivePermissions(
  role: PlatformRole,
  overrides: MemberPermissionRow[] = [],
): MemberPermissions {
  // Owner and admin always get full access — overrides are ignored.
  if (role === 'owner' || role === 'admin') {
    return { role, ...ROLE_DEFAULTS[role] };
  }

  // Start from member defaults, then apply stored overrides.
  const os = { ...ROLE_DEFAULTS.member.os };
  const docs = { ...ROLE_DEFAULTS.member.docs };

  for (const override of overrides) {
    const access = override.access_level;
    if (override.workspace === 'os' && OS_MODULES.includes(override.module as OsModule)) {
      (os as Record<string, ModuleAccess>)[override.module] = access;
    } else if (
      override.workspace === 'docs' &&
      DOCS_MODULES.includes(override.module as DocsModule)
    ) {
      (docs as Record<string, ModuleAccess>)[override.module] = access;
    }
  }

  return { role, os, docs };
}

/** Normalise a raw role string to PlatformRole */
export function normalizePlatformRole(raw: string | null | undefined): PlatformRole {
  if (raw === 'owner') return 'owner';
  if (raw === 'admin') return 'admin';
  return 'member';
}

// ── Access check helpers ──────────────────────────────────────────────────────

/**
 * Returns true if the member has at least the required access level for
 * the given workspace module.
 *
 * Access hierarchy: full > read > none
 */
export function hasModuleAccess(
  perms: MemberPermissions,
  workspace: 'os' | 'docs',
  module: OsModule | DocsModule | string,
  required: ModuleAccess,
): boolean {
  let actual: ModuleAccess;
  if (workspace === 'os') {
    actual = (perms.os as Record<string, ModuleAccess>)[module] ?? 'none';
  } else {
    actual = (perms.docs as Record<string, ModuleAccess>)[module] ?? 'none';
  }

  if (required === 'none') return true;
  if (required === 'read') return actual === 'read' || actual === 'full';
  return actual === 'full';
}

// ── Server-side fetch helper (for API routes) ─────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch stored module overrides for a team member from the DB.
 * Returns resolved MemberPermissions.
 */
export async function fetchMemberPermissions(
  db: SupabaseClient,
  teamMemberId: string,
  role: PlatformRole,
): Promise<MemberPermissions> {
  if (role === 'owner' || role === 'admin') {
    return resolveEffectivePermissions(role, []);
  }

  const { data, error } = await db
    .from('workspace_members')
    .select('workspace, module, access_level')
    .eq('team_member_id', teamMemberId);

  if (error) {
    console.warn('[permissions] fetchMemberPermissions failed:', error.message);
    return resolveEffectivePermissions(role, []);
  }

  return resolveEffectivePermissions(role, (data ?? []) as MemberPermissionRow[]);
}

// ── Blank permission builders (for invite form) ───────────────────────────────

export function buildDefaultPermissions(role: PlatformRole): MemberPermissions {
  return resolveEffectivePermissions(role, []);
}

/** Build a blank (none) permission set — used to selectively grant from zero */
export function buildBlankPermissions(): Omit<MemberPermissions, 'role'> {
  return { os: buildNoneOs(), docs: buildNoneDocs() };
}
