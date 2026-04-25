'use client';

import { useToast } from '@/context/toast-context';
import { cn } from '@/lib/cn';

const toastToneClasses = {
  success: 'border-success/40 bg-success/15 text-success',
  error: 'border-danger/40 bg-danger/15 text-danger',
  warning: 'border-warning/40 bg-warning/15 text-warning',
  info: 'border-accent/40 bg-accent/15 text-primary',
} as const;

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          onClick={() => dismiss(toast.id)}
          className={cn(
            'pointer-events-auto block min-w-[16rem] rounded-control border px-3 py-2 text-left text-sm shadow-soft',
            toastToneClasses[toast.type],
          )}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
}
