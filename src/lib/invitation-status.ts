/**
 * Canonical status values for team_invitations and team_members.
 *
 * These must exactly match the DB CHECK constraints defined in
 * supabase-migration-invitation-status-fix.sql.
 */

export const INVITATION_STATUS = {
  INVITED:  'invited',
  ACCEPTED: 'accepted',
  REVOKED:  'revoked',
  EXPIRED:  'expired',
} as const;

export type InvitationStatus = (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

export const MEMBER_STATUS = {
  ACTIVE:    'active',
  INVITED:   'invited',
  INACTIVE:  'inactive',
  SUSPENDED: 'suspended',
} as const;

export type MemberStatus = (typeof MEMBER_STATUS)[keyof typeof MEMBER_STATUS];

/** Lowercase-normalise a raw status string before writing to the DB. */
export function normalizeStatus(raw: string): string {
  return raw.trim().toLowerCase();
}
