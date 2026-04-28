import { describe, it, expect } from 'vitest';
import {
  normalizeInvitationToken,
  maskInvitationToken,
  validateInvitationState,
  type ResolvedInvitation,
} from '@/lib/team-invitations';

// ── normalizeInvitationToken ──────────────────────────────────────────────────

describe('normalizeInvitationToken', () => {
  it('returns empty string for null', () => {
    expect(normalizeInvitationToken(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(normalizeInvitationToken(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(normalizeInvitationToken('')).toBe('');
  });

  it('trims whitespace', () => {
    expect(normalizeInvitationToken('  abc123  ')).toBe('abc123');
  });

  it('decodes URI-encoded token', () => {
    expect(normalizeInvitationToken('abc%2F123')).toBe('abc/123');
  });

  it('returns raw value when decoding fails', () => {
    expect(normalizeInvitationToken('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

// ── maskInvitationToken ───────────────────────────────────────────────────────

describe('maskInvitationToken', () => {
  it('returns empty string for empty input', () => {
    expect(maskInvitationToken('')).toBe('');
  });

  it('masks short tokens (≤8 chars)', () => {
    const masked = maskInvitationToken('ab1234');
    expect(masked).toContain('...');
    expect(masked.startsWith('ab')).toBe(true);
  });

  it('masks long tokens showing prefix and suffix', () => {
    const token = 'abcdef1234567890';
    const masked = maskInvitationToken(token);
    expect(masked.startsWith('abcdef')).toBe(true);
    expect(masked.endsWith('7890')).toBe(true);
    expect(masked).toContain('...');
  });
});

// ── validateInvitationState ───────────────────────────────────────────────────

function makeInvitation(overrides: Partial<ResolvedInvitation> = {}): ResolvedInvitation {
  return {
    id: 'inv-1',
    token: 'tok-abc',
    email: 'test@example.com',
    role: 'team_member',
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
    team_member_id: 'tm-1',
    workspace_id: 'test-workspace-id',
    ...overrides,
  };
}

describe('validateInvitationState', () => {
  it('returns not_found when invitation is null', () => {
    const result = validateInvitationState(null);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('not_found');
  });

  it('returns valid for a fresh pending invitation', () => {
    const result = validateInvitationState(makeInvitation());
    expect(result.valid).toBe(true);
  });

  it('returns expired when expires_at is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const result = validateInvitationState(makeInvitation({ expires_at: past }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('expired');
  });

  it('returns expired when expires_at equals now', () => {
    const now = new Date(Date.now() - 1).toISOString();
    const result = validateInvitationState(makeInvitation({ expires_at: now }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('expired');
  });

  it('returns used when status is accepted', () => {
    const result = validateInvitationState(makeInvitation({ status: 'accepted' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('used');
  });

  it('returns valid for invited status', () => {
    const result = validateInvitationState(makeInvitation({ status: 'invited' }));
    expect(result.valid).toBe(true);
  });

  it('returns not_found for invalid expires_at', () => {
    const result = validateInvitationState(makeInvitation({ expires_at: 'not-a-date' }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe('not_found');
  });
});
