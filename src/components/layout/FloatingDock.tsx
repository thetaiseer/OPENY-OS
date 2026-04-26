'use client';

import GlobalUploadQueue from '@/components/features/upload/GlobalUploadQueue';
import FloatingActionButton from '@/components/ui/FloatingActionButton';
import { cn } from '@/lib/cn';

/**
 * Pins the quick-action FAB and the upload queue trigger together so the
 * upload UI never stacks on top of the FAB — same bottom offset, horizontal gap.
 */
export default function FloatingDock() {
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
        <FloatingActionButton />
      </div>
    </div>
  );
}
