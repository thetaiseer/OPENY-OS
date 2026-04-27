'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';
import type { Task } from '@/lib/types';

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) =>
      apiRequest<{ success: true }>(`/api/tasks/${encodeURIComponent(taskId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks-all'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks-all']);
      queryClient.setQueryData<Task[]>(['tasks-all'], (old = []) =>
        old.filter((task) => task.id !== taskId),
      );
      return { previous };
    },
    onError: (error, _taskId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks-all'], context.previous);
      }
      toast(error instanceof Error ? error.message : 'Failed to delete task', 'error');
    },
    onSuccess: () => toast('Task deleted', 'success'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks-all'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks-my'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overdue-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-upcoming-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
