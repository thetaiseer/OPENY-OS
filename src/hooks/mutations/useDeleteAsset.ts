'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';
import type { Asset } from '@/lib/types';

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (assetId: string) =>
      apiRequest<{ success: true }>(`/api/assets/${encodeURIComponent(assetId)}`, {
        method: 'DELETE',
      }),
    onMutate: async (assetId) => {
      await queryClient.cancelQueries({ queryKey: ['assets'] });
      const previous = queryClient.getQueryData<Asset[]>(['assets']);
      queryClient.setQueryData<Asset[]>(['assets'], (old = []) =>
        old.filter((asset) => asset.id !== assetId),
      );
      return { previous };
    },
    onError: (error, _assetId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['assets'], context.previous);
      }
      toast(error instanceof Error ? error.message : 'Failed to delete asset', 'error');
    },
    onSuccess: () => toast('Asset deleted', 'success'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['assets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-assets'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    },
  });
}
