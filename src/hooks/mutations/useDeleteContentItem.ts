'use client';

import type { ContentItem } from '@/lib/types';
import { useDeleteEntity } from '@/hooks/mutations/useDeleteEntity';

export function useDeleteContentItem() {
  return useDeleteEntity<{ success: boolean; items: ContentItem[] }>({
    entityLabel: 'content item',
    endpoint: (contentId) => `/api/content-items/${contentId}`,
    optimistic: {
      queryKey: ['content-items'],
      remove: (old, contentId) =>
        old
          ? {
              ...old,
              items: old.items.filter((item) => item.id !== contentId),
            }
          : old,
    },
    invalidateKeys: [
      ['content-items'],
      ['content'],
      ['activity'],
      ['clients-stats'],
      ['client-overview-data'],
    ],
    successMessage: 'Content deleted',
    failureMessage: 'Failed to delete content item',
  });
}
