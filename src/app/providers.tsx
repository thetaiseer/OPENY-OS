'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuickActionsProvider } from '@/context/quick-actions-context';
import { ToastProvider } from '@/context/toast-context';
import { UploadProvider } from '@/context/upload-context';
import GlobalUploadQueue from '@/components/features/upload/GlobalUploadQueue';
import ToastContainer from '@/components/ui/ToastContainer';

// Singleton QueryClient shared across all route trees (OS, Docs, workspace selector).
// Instantiated once at module scope so it survives React re-renders.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Keep data fresh for 2 minutes — re-navigating within this window
      // shows cached data instantly without a loading spinner.
      staleTime: 2 * 60 * 1000,
      // Keep inactive query data in cache for 10 minutes so coming back to a
      // page after browsing elsewhere still shows the previous result while
      // a background refresh runs in parallel.
      gcTime: 10 * 60 * 1000,
    },
  },
});

export { queryClient };

/**
 * Global providers that must be available in every route tree:
 *   - QueryClientProvider  (react-query)
 *   - ToastProvider        (in-app toasts)
 *   - ToastContainer       (renders toast DOM nodes)
 *
 * Placed in the root layout so that /, /os, and /docs
 * all receive the same QueryClient instance.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <QuickActionsProvider>
        <ToastProvider>
          <UploadProvider>
            {children}
            <GlobalUploadQueue />
            <ToastContainer />
          </UploadProvider>
        </ToastProvider>
      </QuickActionsProvider>
    </QueryClientProvider>
  );
}
