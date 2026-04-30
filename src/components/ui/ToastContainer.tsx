'use client';

import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TOAST_ENTER_ANIMATION_MS, useToast } from '@/context/toast-context';

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (!toasts.length) return null;

  const tone = (type: 'success' | 'error' | 'warning' | 'info') => {
    if (type === 'success')
      return {
        icon: CheckCircle2,
        shell:
          'border-[color:var(--success)]/35 bg-[color:var(--card)] text-[color:var(--card-foreground)]',
        iconColor: 'text-[color:var(--success)]',
      };
    if (type === 'error')
      return {
        icon: XCircle,
        shell:
          'border-[color:var(--destructive)]/40 bg-[color:var(--card)] text-[color:var(--card-foreground)]',
        iconColor: 'text-[color:var(--destructive)]',
      };
    if (type === 'warning')
      return {
        icon: AlertTriangle,
        shell:
          'border-[color:var(--warning)]/38 bg-[color:var(--card)] text-[color:var(--card-foreground)]',
        iconColor: 'text-[color:var(--warning)]',
      };
    return {
      icon: Info,
      shell:
        'border-[color:var(--primary)]/36 bg-[color:var(--card)] text-[color:var(--card-foreground)]',
      iconColor: 'text-[color:var(--primary)]',
    };
  };

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1200] flex w-[min(92vw,24rem)] flex-col gap-2">
      {toasts.map((toast) => {
        const variant = tone(toast.type);
        const Icon = variant.icon;
        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2.5 shadow-[0_16px_40px_var(--openy-glow)] transition-all',
              variant.shell,
              toast.closing
                ? 'translate-y-2 opacity-0'
                : `animate-[openy-fade-up_${TOAST_ENTER_ANIMATION_MS}ms_cubic-bezier(0.2,0.7,0.2,1)]`,
            )}
            role="status"
            aria-live="polite"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', variant.iconColor)} />
            <p className="min-w-0 flex-1 text-sm leading-5">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[color:var(--muted-foreground)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--foreground)]"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
