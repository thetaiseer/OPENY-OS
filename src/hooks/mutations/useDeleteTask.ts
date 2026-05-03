'use client';

import type { Task } from '@/lib/types';
import { useDeleteEntity } from '@/hooks/mutations/useDeleteEntity';

export function useDeleteTask() {
  return useDeleteEntity<Task[]>({
    entityLabel: 'task',
    endpoint: (taskId) => `/api/tasks/${taskId}`,
    optimistic: {
      queryKey: ['tasks-all'],
      remove: (old = [], taskId) => old.filter((task) => task.id !== taskId),
    },
    invalidateKeys: [
      ['tasks-all'],
      ['tasks-my'],
      ['tasks'],
      ['dashboard-overdue-tasks'],
      ['dashboard-upcoming-tasks'],
      ['activity'],
      ['clients-stats'],
      ['client-overview-data'],
    ],
    successMessage: 'Task deleted',
    failureMessage: 'Failed to delete task',
  });
}
