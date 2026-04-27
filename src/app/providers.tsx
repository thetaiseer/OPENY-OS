'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppPeriodProvider } from '@/context/app-period-context';
import { QuickActionsProvider } from '@/context/quick-actions-context';
import { ToastProvider } from '@/context/toast-context';
import { UploadProvider } from '@/context/upload-context';
import ToastContainer from '@/components/ui/ToastContainer';
import { OPENY_QUERY_DEFAULTS } from '@/hooks/workspace-query';

// Singleton QueryClient shared across all route trees (OS, Docs, workspace selector).
// Instantiated once at module scope so it survives React re-renders.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      ...OPENY_QUERY_DEFAULTS,
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
      <AppPeriodProvider>
        <QuickActionsProvider>
          <ToastProvider>
            <UploadProvider>
              {children}
              <ToastContainer />
            </UploadProvider>
          </ToastProvider>
        </QuickActionsProvider>
      </AppPeriodProvider>
    </QueryClientProvider>
  );
}
