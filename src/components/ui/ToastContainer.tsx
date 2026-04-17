'use client';

import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToast, type ToastItem } from '@/lib/toast-context';

const STYLE: Record<ToastItem['type'], { bg: string; border: string; icon: React.ReactNode }> = {
  success: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.35)',
    icon: <CheckCircle size={16} className="shrink-0" style={{ color: '#10b981' }} />,
  },
  error: {
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.35)',
    icon: <AlertCircle size={16} className="shrink-0" style={{ color: '#ef4444' }} />,
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.35)',
    icon: <AlertTriangle size={16} className="shrink-0" style={{ color: '#f59e0b' }} />,
  },
  info: {
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.35)',
    icon: <Info size={16} className="shrink-0" style={{ color: '#3b82f6' }} />,
  },
};

const TEXT_COLOR: Record<ToastItem['type'], string> = {
  success: '#10b981',
  error:   '#ef4444',
  warning: '#f59e0b',
  info:    '#3b82f6',
};

export default function ToastContainer() {
  const { toasts, dismiss } = useToast();
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-[60] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-sm">
      {toasts.map(t => {
        const { bg, border, icon } = STYLE[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium animate-openy-toast-in"
            style={{
              background: `var(--surface)`,
              backdropFilter: 'blur(16px)',
              borderColor: border,
              boxShadow: `var(--shadow-lg), 0 0 0 1px ${border}`,
              color: 'var(--text)',
              minWidth: 240,
            }}
          >
            {icon}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 transition-opacity hover:opacity-100 opacity-50 p-0.5 rounded"
              style={{ color: TEXT_COLOR[t.type] }}
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
