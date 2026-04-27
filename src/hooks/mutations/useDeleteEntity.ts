'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useToast } from '@/context/toast-context';
import { apiRequest } from '@/lib/api/request';

type UseDeleteEntityOptions<TCache> = {
  entityLabel: string;
  endpoint: (id: string) => string;
  optimistic: {
    queryKey: QueryKey;
    remove: (old: TCache | undefined, id: string) => TCache | undefined;
  };
  invalidateKeys: QueryKey[];
  successMessage: string;
  failureMessage: string;
};

export function useDeleteEntity<TCache>(options: UseDeleteEntityOptions<TCache>) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) =>
      apiRequest<{ success: true }>(options.endpoint(encodeURIComponent(id)), { method: 'DELETE' }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: options.optimistic.queryKey });
      const previous = queryClient.getQueryData<TCache>(options.optimistic.queryKey);
      queryClient.setQueryData<TCache>(options.optimistic.queryKey, (old) =>
        options.optimistic.remove(old, id),
      );
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(options.optimistic.queryKey, context.previous);
      }
      toast(
        error instanceof Error
          ? error.message
          : `${options.failureMessage} (${options.entityLabel})`,
        'error',
      );
    },
    onSuccess: () => toast(options.successMessage, 'success'),
    onSettled: () => {
      options.invalidateKeys.forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    },
  });
}
