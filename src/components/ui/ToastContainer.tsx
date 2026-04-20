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
    <div className="fixed bottom-6 right-[340px] z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const { bg, icon } = STYLE[t.type];
        return (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
            style={{ background: bg, minWidth: 260, maxWidth: 380 }}
          >
            {icon}
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
