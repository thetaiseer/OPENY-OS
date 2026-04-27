'use client';

import { keepPreviousData, type QueryClient } from '@tanstack/react-query';

export function workspaceKey<T extends readonly unknown[]>(
  workspaceId: string | null | undefined,
  ...parts: T
): readonly ['ws', string | null, ...T] {
  return ['ws', workspaceId ?? null, ...parts] as const;
}

export const OPENY_QUERY_DEFAULTS = {
  staleTime: 45_000,
  gcTime: 15 * 60_000,
  retry: 1,
  refetchOnWindowFocus: false,
  placeholderData: keepPreviousData,
} as const;

export async function prefetchWorkspaceCore(
  queryClient: QueryClient,
  workspaceId: string | null | undefined,
): Promise<void> {
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: workspaceKey(workspaceId, 'dashboard-stats'),
      staleTime: 45_000,
      queryFn: async () => null,
    }),
    queryClient.prefetchQuery({
      queryKey: workspaceKey(workspaceId, 'tasks-all'),
      staleTime: 45_000,
      queryFn: async () => [],
    }),
  ]);
}
