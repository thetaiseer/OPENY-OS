import type { QuickActionId } from '@/context/quick-actions-context';

export const PENDING_QUICK_ACTION_KEY = 'openy_pending_quick_action';

export function queuePendingQuickAction(action: QuickActionId): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(PENDING_QUICK_ACTION_KEY, action);
  } catch {
    /* private mode / quota */
  }
}

/** Read and clear pending quick action (call once on target page mount). */
export function consumePendingQuickAction(): QuickActionId | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(PENDING_QUICK_ACTION_KEY);
    sessionStorage.removeItem(PENDING_QUICK_ACTION_KEY);
    if (
      v === 'add-client' ||
      v === 'add-task' ||
      v === 'add-project' ||
      v === 'add-note' ||
      v === 'add-content' ||
      v === 'add-asset'
    ) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}
