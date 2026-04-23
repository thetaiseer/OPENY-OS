import { describe, it, expect } from 'vitest';
import {
  normalizeWorkspaceKey,
  getWorkspaceLabel,
  getWorkspaceFromAppPath,
  getWorkspaceFromApiPath,
  mapWorkspaceRoleToUserRole,
  mapAccessRoleToWorkspaceRole,
} from '@/lib/workspace-access';

describe('normalizeWorkspaceKey', () => {
  it('returns os for "os"', () => expect(normalizeWorkspaceKey('os')).toBe('os'));
  it('returns docs for "docs"', () => expect(normalizeWorkspaceKey('docs')).toBe('docs'));
  it('is case-insensitive', () => {
    expect(normalizeWorkspaceKey('OS')).toBe('os');
    expect(normalizeWorkspaceKey('DOCS')).toBe('docs');
  });
  it('returns null for unknown values', () => expect(normalizeWorkspaceKey('admin')).toBeNull());
  it('returns null for non-string', () => expect(normalizeWorkspaceKey(42)).toBeNull());
});

describe('getWorkspaceLabel', () => {
  it('returns OPENY OS for os', () => expect(getWorkspaceLabel('os')).toBe('OPENY OS'));
  it('returns OPENY DOCS for docs', () => expect(getWorkspaceLabel('docs')).toBe('OPENY DOCS'));
});

describe('getWorkspaceFromAppPath', () => {
  it('returns docs for /docs', () => expect(getWorkspaceFromAppPath('/docs')).toBe('docs'));
  it('returns docs for /docs/invoices', () =>
    expect(getWorkspaceFromAppPath('/docs/invoices')).toBe('docs'));
  it('returns docs for /invoice (legacy)', () =>
    expect(getWorkspaceFromAppPath('/invoice')).toBe('docs'));
  it('returns os for /os/dashboard', () =>
    expect(getWorkspaceFromAppPath('/os/dashboard')).toBe('os'));
  it('returns null for /dashboard', () => expect(getWorkspaceFromAppPath('/dashboard')).toBeNull());
  it('strips trailing slashes', () => expect(getWorkspaceFromAppPath('/docs/')).toBe('docs'));
});

describe('getWorkspaceFromApiPath', () => {
  it('returns docs for /api/docs', () => expect(getWorkspaceFromApiPath('/api/docs')).toBe('docs'));
  it('returns null for /api/auth/login', () =>
    expect(getWorkspaceFromApiPath('/api/auth/login')).toBeNull());
  it('returns os for /api/tasks', () => expect(getWorkspaceFromApiPath('/api/tasks')).toBe('os'));
  it('returns os for /api/clients/123', () =>
    expect(getWorkspaceFromApiPath('/api/clients/123')).toBe('os'));
});

describe('mapWorkspaceRoleToUserRole', () => {
  it('maps owner to owner', () => expect(mapWorkspaceRoleToUserRole('owner')).toBe('owner'));
  it('maps admin to admin', () => expect(mapWorkspaceRoleToUserRole('admin')).toBe('admin'));
  it('maps member to team_member', () =>
    expect(mapWorkspaceRoleToUserRole('member')).toBe('team_member'));
  it('maps viewer to viewer', () => expect(mapWorkspaceRoleToUserRole('viewer')).toBe('viewer'));
  it('maps null to team_member', () =>
    expect(mapWorkspaceRoleToUserRole(null)).toBe('team_member'));
});

describe('mapAccessRoleToWorkspaceRole', () => {
  it('maps admin to admin', () => expect(mapAccessRoleToWorkspaceRole('admin')).toBe('admin'));
  it('maps manager to admin', () => expect(mapAccessRoleToWorkspaceRole('manager')).toBe('admin'));
  it('maps viewer to viewer', () => expect(mapAccessRoleToWorkspaceRole('viewer')).toBe('viewer'));
  it('maps team_member to member', () =>
    expect(mapAccessRoleToWorkspaceRole('team_member')).toBe('member'));
  it('maps unknown to member', () =>
    expect(mapAccessRoleToWorkspaceRole('unknown')).toBe('member'));
});
