'use client';

import type { Asset } from '@/lib/types';
import { useDeleteEntity } from '@/hooks/mutations/useDeleteEntity';

export function useDeleteAsset() {
  return useDeleteEntity<Asset[]>({
    entityLabel: 'asset',
    endpoint: (assetId) => `/api/assets/${assetId}`,
    optimistic: {
      queryKey: ['assets'],
      remove: (old = [], assetId) => old.filter((asset) => asset.id !== assetId),
    },
    invalidateKeys: [
      ['assets'],
      ['dashboard-assets'],
      ['activity'],
      ['clients-stats'],
      ['client-overview-data'],
    ],
    successMessage: 'Asset deleted',
    failureMessage: 'Failed to delete asset',
  });
}
