'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';
import type { ContentItem } from '@/lib/types';

export function useDeleteContentItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (contentId: string) =>
      apiRequest<{ success: true }>(`/api/content-items/${encodeURIComponent(contentId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (contentId) => {
      await queryClient.cancelQueries({ queryKey: ['content-items'] });
      const previous = queryClient.getQueryData<{ success: boolean; items: ContentItem[] }>([
        'content-items',
      ]);
      queryClient.setQueryData<{ success: boolean; items: ContentItem[] }>(
        ['content-items'],
        (old) =>
          old
            ? {
                ...old,
                items: old.items.filter((item) => item.id !== contentId),
              }
            : old,
      );
      return { previous };
    },
    onError: (error, _contentId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['content-items'], context.previous);
      }
      toast(error instanceof Error ? error.message : 'Failed to delete content item', 'error');
    },
    onSuccess: () => toast('Content deleted', 'success'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['content-items'] });
      void queryClient.invalidateQueries({ queryKey: ['content'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
