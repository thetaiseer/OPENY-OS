'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';
import type { Client } from '@/lib/types';

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (clientId: string) =>
      apiRequest<{ success: true }>(`/api/clients/${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (clientId) => {
      await queryClient.cancelQueries({ queryKey: ['clients-list'] });
      const previous = queryClient.getQueryData<Client[]>(['clients-list']);
      queryClient.setQueryData<Client[]>(['clients-list'], (old = []) =>
        old.filter((client) => client.id !== clientId),
      );
      return { previous };
    },
    onError: (error, _clientId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['clients-list'], context.previous);
      }
      toast(error instanceof Error ? error.message : 'Failed to delete client', 'error');
    },
    onSuccess: () => toast('Client deleted', 'success'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['clients-list'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-projects-mini'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overdue-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
