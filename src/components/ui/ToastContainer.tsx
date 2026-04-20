'use client';

import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, type ToastItem } from '@/lib/toast-context';

const STYLE: Record<ToastItem['type'], { bg: string; icon: React.ReactNode }> = {
  success: { bg: '#16a34a', icon: <CheckCircle  size={16} className="shrink-0" /> },
  error:   { bg: '#dc2626', icon: <AlertCircle  size={16} className="shrink-0" /> },
  warning: { bg: '#d97706', icon: <AlertTriangle size={16} className="shrink-0" /> },
  info:    { bg: '#2563eb', icon: <Info          size={16} className="shrink-0" /> },
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <>
      <div
        className="pointer-events-none fixed left-1/2 z-[80] flex w-[calc(100vw-32px)] max-w-[420px] -translate-x-1/2 flex-col gap-2 sm:w-[min(calc(100vw-48px),420px)]"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        {toasts.map(t => {
          const { bg, icon } = STYLE[t.type];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg"
              style={{ background: bg, animation: t.closing ? 'toast-out 180ms ease-in forwards' : 'toast-in 220ms ease-out' }}
            >
              {icon}
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to { opacity: 0; transform: translateY(8px) scale(0.98); }
        }
      `}</style>
    </>
  );
}
