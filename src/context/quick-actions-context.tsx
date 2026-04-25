'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

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
  const handlersRef = useRef<Partial<Record<QuickActionId, QuickActionHandler>>>({});
  const [fallbackAction, setFallbackAction] = useState<QuickActionId | null>(null);

  const triggerQuickAction = useCallback((action: QuickActionId) => {
    const handler = handlersRef.current[action];
    if (handler) {
      handler();
      return;
    }
    setFallbackAction(action);
  }, []);

  const registerQuickActionHandler = useCallback(
    (action: QuickActionId, handler: QuickActionHandler) => {
      handlersRef.current[action] = handler;
      return () => {
        if (handlersRef.current[action] === handler) {
          delete handlersRef.current[action];
        }
      };
    },
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
