import type { TeamInvitation, TeamMember } from '@/lib/types';

export function hasInviteInsertResult(
  data: unknown,
): data is { member: TeamMember; invitation: TeamInvitation } {
  if (!data || typeof data !== 'object') return false;
  const payload = data as { member?: Partial<TeamMember>; invitation?: Partial<TeamInvitation> };
  return Boolean(
    payload.member?.id &&
      payload.member?.full_name &&
      payload.member?.email &&
      payload.invitation?.id &&
      payload.invitation?.team_member_id &&
      payload.invitation?.email,
  );
}

export function isInviteRegeneratedResult(
  data: unknown,
): data is { regenerated: true; success?: boolean } {
  if (!data || typeof data !== 'object') return false;
  return (data as { regenerated?: boolean }).regenerated === true;
}
