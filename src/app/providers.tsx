'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/lib/toast-context';
import { ToastStack } from '@/new-ui/interactive';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

export { queryClient };

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <ToastStack />
      </ToastProvider>
    </QueryClientProvider>
  );
}
