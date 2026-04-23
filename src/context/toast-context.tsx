'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';
export const TOAST_ENTER_ANIMATION_MS = 220;
export const TOAST_EXIT_ANIMATION_MS = 180;

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  closing?: boolean;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, type?: ToastType, durationMs?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  toast: () => {},
  dismiss: () => {},
});

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastsRef = useRef<ToastItem[]>([]);
  const autoDismissTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const removeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // Keep latest toasts accessible from stable callbacks without re-creating them.
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);

  // Refs are intentionally used here so timer maps stay stable across renders.
  const clearTimers = useCallback((id: number) => {
    const autoDismissTimer = autoDismissTimers.current.get(id);
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimers.current.delete(id);
    }
    const removeTimer = removeTimers.current.get(id);
    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimers.current.delete(id);
    }
  }, []);

  const remove = useCallback(
    (id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      clearTimers(id);
    },
    [clearTimers],
  );

  const dismiss = useCallback(
    (id: number) => {
      const existing = toastsRef.current.find((t) => t.id === id);
      if (!existing || existing.closing) return;
      setToasts((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t;
          return { ...t, closing: true };
        }),
      );
      const existingRemoveTimer = removeTimers.current.get(id);
      if (!existingRemoveTimer) {
        const removeTimer = setTimeout(() => remove(id), TOAST_EXIT_ANIMATION_MS);
        removeTimers.current.set(id, removeTimer);
      }
    },
    [remove],
  );

  const toast = useCallback(
    (message: string, type: ToastType = 'info', durationMs = 4000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      const tid = setTimeout(() => dismiss(id), durationMs);
      autoDismissTimers.current.set(id, tid);
    },
    [dismiss],
  );

  // Cleanup timers only when the provider unmounts.
  useEffect(() => {
    const autoDismissMap = autoDismissTimers.current;
    const removeMap = removeTimers.current;
    return () => {
      autoDismissMap.forEach((timer) => clearTimeout(timer));
      removeMap.forEach((timer) => clearTimeout(timer));
      autoDismissMap.clear();
      removeMap.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
