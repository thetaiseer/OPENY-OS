'use client';

import { useToast, ToastItem } from '@/lib/toast-context';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { ReactNode } from 'react';

const TYPE_ICON: Record<string, ReactNode> = {
  success: <CheckCircle2  size={15} style={{ color: 'var(--success)' }} />,
  warning: <AlertTriangle size={15} style={{ color: 'var(--warning)' }} />,
  error:   <XCircle       size={15} style={{ color: 'var(--danger)'  }} />,
  info:    <Info          size={15} style={{ color: 'var(--info)'    }} />,
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  return (
    <div className="ui-toast" data-type={item.type} onClick={onDismiss} role="alert">
      {TYPE_ICON[item.type] ?? <div className="ui-toast-dot" />}
      <span style={{ flex: 1 }}>{item.message}</span>
      <button
        aria-label="Dismiss"
        onClick={e => { e.stopPropagation(); onDismiss(); }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 2,
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/**
 * ToastContainer — renders all active toasts in a fixed bottom-right stack.
 * Connects to ToastProvider via useToast.
 */
export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="ui-toast-stack" aria-live="polite">
      {toasts.map(t => (
        <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

