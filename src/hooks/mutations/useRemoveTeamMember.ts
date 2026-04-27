'use client';

import type { TeamMember } from '@/lib/types';
import { useDeleteEntity } from '@/hooks/mutations/useDeleteEntity';

export function useRemoveTeamMember() {
  return useDeleteEntity<{
    members: TeamMember[];
    invitations: unknown[];
    workspaceAccess: Record<string, unknown>;
  }>({
    entityLabel: 'team member',
    endpoint: (memberId) => `/api/team/members/${memberId}`,
    optimistic: {
      queryKey: ['team-data'],
      remove: (old, memberId) =>
        old
          ? {
              ...old,
              members: old.members.filter((member) => member.id !== memberId),
            }
          : old,
    },
    invalidateKeys: [['team-data'], ['activity']],
    successMessage: 'Member removed',
    failureMessage: 'Failed to remove member',
  });
}
