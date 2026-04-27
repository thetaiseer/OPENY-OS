import { describe, expect, it } from 'vitest';
import { hasInviteInsertResult, isInviteRegeneratedResult } from '@/lib/team-invite-response';

describe('team invite response helpers', () => {
  it('recognizes a created invite payload with member and invitation rows', () => {
    expect(
      hasInviteInsertResult({
        member: {
          id: 'member-1',
          full_name: 'Taylor Agent',
          email: 'taylor@example.com',
        },
        invitation: {
          id: 'invite-1',
          team_member_id: 'member-1',
          email: 'taylor@example.com',
        },
      }),
    ).toBe(true);
  });

  it('recognizes a regenerated invite payload without fresh rows', () => {
    const regenerated = { success: true, regenerated: true };

    expect(isInviteRegeneratedResult(regenerated)).toBe(true);
    expect(hasInviteInsertResult(regenerated)).toBe(false);
  });

  it('rejects unrelated successful payloads', () => {
    expect(isInviteRegeneratedResult({ success: true })).toBe(false);
    expect(hasInviteInsertResult({ success: true })).toBe(false);
  });
});
