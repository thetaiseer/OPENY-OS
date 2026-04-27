'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';
import type { Project } from '@/lib/types';

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (projectId: string) =>
      apiRequest<{ success: true }>(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (projectId) => {
      await queryClient.cancelQueries({ queryKey: ['projects-all'] });
      const previous = queryClient.getQueryData<Project[]>(['projects-all']);
      queryClient.setQueryData<Project[]>(['projects-all'], (old = []) =>
        old.filter((project) => project.id !== projectId),
      );
      return { previous };
    },
    onError: (error, _projectId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['projects-all'], context.previous);
      }
      toast(error instanceof Error ? error.message : 'Failed to delete project', 'error');
    },
    onSuccess: () => toast('Project deleted', 'success'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects-all'] });
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-projects-mini'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
