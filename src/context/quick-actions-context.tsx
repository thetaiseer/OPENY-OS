'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type QuickActionId =
  | 'add-client'
  | 'add-task'
  | 'add-project'
  | 'add-note'
  | 'add-content'
  | 'add-asset';

type QuickActionHandler = () => void;

interface QuickActionsContextValue {
  triggerQuickAction: (action: QuickActionId) => void;
  /** @deprecated No longer used; kept so existing pages do not break during refactors. */
  registerQuickActionHandler: (action: QuickActionId, handler: QuickActionHandler) => () => void;
  fallbackAction: QuickActionId | null;
  clearFallbackAction: () => void;
}

const QuickActionsContext = createContext<QuickActionsContextValue>({
  triggerQuickAction: () => {},
  registerQuickActionHandler: () => () => {},
  fallbackAction: null,
  clearFallbackAction: () => {},
});

export function QuickActionsProvider({ children }: { children: ReactNode }) {
  const [fallbackAction, setFallbackAction] = useState<QuickActionId | null>(null);

  const triggerQuickAction = useCallback((action: QuickActionId) => {
    setFallbackAction(action);
  }, []);

  const registerQuickActionHandler = useCallback(
    (_action: QuickActionId, _handler: QuickActionHandler) => () => {},
    [],
  );

  const clearFallbackAction = useCallback(() => setFallbackAction(null), []);

  const value = useMemo(
    () => ({
      triggerQuickAction,
      registerQuickActionHandler,
      fallbackAction,
      clearFallbackAction,
    }),
    [triggerQuickAction, registerQuickActionHandler, fallbackAction, clearFallbackAction],
  );

  return <QuickActionsContext.Provider value={value}>{children}</QuickActionsContext.Provider>;
}

export function useQuickActions() {
  return useContext(QuickActionsContext);
}
