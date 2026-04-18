'use client';

import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, type ToastItem } from '@/lib/toast-context';

const styleMap: Record<ToastItem['type'], { icon: React.ReactNode; border: string; color: string }> = {
  success: {
    icon: <CheckCircle size={15} className="shrink-0" />,
    border: 'var(--color-success-border)',
    color: 'var(--color-success)',
  },
  error: {
    icon: <AlertCircle size={15} className="shrink-0" />,
    border: 'var(--color-danger-border)',
    color: 'var(--color-danger)',
  },
  warning: {
    icon: <AlertTriangle size={15} className="shrink-0" />,
    border: 'var(--color-warning-border)',
    color: 'var(--color-warning)',
  },
  info: {
    icon: <Info size={15} className="shrink-0" />,
    border: 'var(--color-info-border)',
    color: 'var(--color-info)',
  },
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-4 z-[60] flex max-w-xs flex-col gap-2 sm:right-5">
      {toasts.map((toast) => {
        const style = styleMap[toast.type];
        return (
          <div
            key={toast.id}
            className="animate-openy-toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13px] font-medium"
            style={{
              borderColor: style.border,
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-md)',
              color: 'var(--text-primary)',
            }}
          >
            <span style={{ color: style.color }}>{style.icon}</span>
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 opacity-50 transition-opacity hover:opacity-100"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
