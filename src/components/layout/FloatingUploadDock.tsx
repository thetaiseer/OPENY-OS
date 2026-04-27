'use client';

import GlobalUploadQueue from '@/components/features/upload/GlobalUploadQueue';
import { cn } from '@/lib/cn';

/**
 * Upload queue only (fixed bottom-end). Quick-action FAB lives on the dashboard page only.
 */
export default function FloatingUploadDock() {
  return (
    <div
      className={cn(
        'pointer-events-none fixed z-50 flex flex-row items-end gap-3',
        'bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] end-[max(1.25rem,env(safe-area-inset-right,0px))]',
        'md:bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] md:end-[max(1.25rem,env(safe-area-inset-right,0px))]',
      )}
    >
      <div className="pointer-events-auto flex flex-row items-end gap-3">
        <GlobalUploadQueue />
      </div>
    </div>
  );
}
