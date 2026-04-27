'use client';

import type { Client } from '@/lib/types';
import { useDeleteEntity } from '@/hooks/mutations/useDeleteEntity';

export function useDeleteClient() {
  return useDeleteEntity<Client[]>({
    entityLabel: 'client',
    endpoint: (clientId) => `/api/clients/${clientId}`,
    optimistic: {
      queryKey: ['clients-list'],
      remove: (old = [], clientId) => old.filter((client) => client.id !== clientId),
    },
    invalidateKeys: [
      ['clients-list'],
      ['dashboard-projects-mini'],
      ['dashboard-overdue-tasks'],
      ['activity'],
    ],
    successMessage: 'Client deleted',
    failureMessage: 'Failed to delete client',
  });
}
