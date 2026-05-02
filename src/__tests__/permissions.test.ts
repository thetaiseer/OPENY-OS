import { describe, expect, it } from 'vitest';
import { canDelete } from '@/lib/permissions';

describe('canDelete', () => {
  it('does not allow regular members to delete workspace-wide records', () => {
    expect(canDelete('team_member', 'client')).toBe(false);
    expect(canDelete('team_member', 'project')).toBe(false);
    expect(canDelete('team_member', 'team_member')).toBe(false);
  });

  it('allows managers to delete managed entities but not team members', () => {
    expect(canDelete('manager', 'client')).toBe(true);
    expect(canDelete('manager', 'project')).toBe(true);
    expect(canDelete('manager', 'team_member')).toBe(false);
  });
});
