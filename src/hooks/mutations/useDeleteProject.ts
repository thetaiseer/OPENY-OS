'use client';

import type { Project } from '@/lib/types';
import { useDeleteEntity } from '@/hooks/mutations/useDeleteEntity';

export function useDeleteProject() {
  return useDeleteEntity<Project[]>({
    entityLabel: 'project',
    endpoint: (projectId) => `/api/projects/${projectId}`,
    optimistic: {
      queryKey: ['projects-all'],
      remove: (old = [], projectId) => old.filter((project) => project.id !== projectId),
    },
    invalidateKeys: [['projects-all'], ['projects'], ['dashboard-projects-mini'], ['activity']],
    successMessage: 'Project deleted',
    failureMessage: 'Failed to delete project',
  });
}
