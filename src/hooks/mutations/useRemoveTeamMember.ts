'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';
import type { TeamMember } from '@/lib/types';

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (memberId: string) =>
      apiRequest<{ success: true }>(`/api/team/members/${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: ['team-data'] });
      const previous = queryClient.getQueryData<{
        members: TeamMember[];
        invitations: unknown[];
        workspaceAccess: Record<string, unknown>;
      }>(['team-data']);
      queryClient.setQueryData(['team-data'], (old: typeof previous) => {
        if (!old) return old;
        return {
          ...old,
          members: old.members.filter((member) => member.id !== memberId),
        };
      });
      return { previous };
    },
    onError: (error, _memberId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['team-data'], context.previous);
      }
      toast(error instanceof Error ? error.message : 'Failed to remove member', 'error');
    },
    onSuccess: () => toast('Member removed', 'success'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['team-data'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
