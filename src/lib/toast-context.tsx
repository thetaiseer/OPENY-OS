'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

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
  const autoDismissTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const removeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

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

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    clearTimers(id);
  }, [clearTimers]);

  const dismiss = useCallback((id: number) => {
    let shouldScheduleRemoval = false;
    setToasts(prev => prev.map(t => {
      if (t.id !== id) return t;
      if (t.closing) return t;
      shouldScheduleRemoval = true;
      return { ...t, closing: true };
    }));
    const existingRemoveTimer = removeTimers.current.get(id);
    if (shouldScheduleRemoval && !existingRemoveTimer) {
      const removeTimer = setTimeout(() => remove(id), 180);
      removeTimers.current.set(id, removeTimer);
    }
  }, [remove]);

  const toast = useCallback((message: string, type: ToastType = 'info', durationMs = 4000) => {
    const id = nextId++;
    setToasts(prev => [...prev, { id, message, type }]);
    const tid = setTimeout(() => dismiss(id), durationMs);
    autoDismissTimers.current.set(id, tid);
  }, [dismiss]);

  useEffect(() => () => {
    autoDismissTimers.current.forEach(clearTimeout);
    removeTimers.current.forEach(clearTimeout);
    autoDismissTimers.current.clear();
    removeTimers.current.clear();
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
