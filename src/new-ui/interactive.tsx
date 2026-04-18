'use client';

import { useState } from 'react';
import { useToast } from '@/lib/toast-context';

export function Tabs({ items }: { items: string[] }) {
  const [active, setActive] = useState(items[0]);
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map(item => (
        <button key={item} className="ui-btn" onClick={() => setActive(item)} style={{ borderColor: active === item ? 'rgba(140, 91, 255, 0.6)' : undefined }}>
          {item}
        </button>
      ))}
    </div>
  );
}

export function ActionMenu() {
  return (
    <details>
      <summary className="ui-btn" style={{ listStyle: 'none', cursor: 'pointer' }}>Actions ▾</summary>
      <div className="ui-card" style={{ marginTop: 8, display: 'grid', gap: 8 }}>
        <button className="ui-btn">Edit</button>
        <button className="ui-btn">Duplicate</button>
        <button className="ui-btn">Archive</button>
      </div>
    </details>
  );
}

export function DemoModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="ui-btn" onClick={() => setOpen(true)}>Open Modal</button>
      {open ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'grid', placeItems: 'center', zIndex: 70 }}>
          <div className="ui-card" style={{ width: 'min(92vw, 480px)' }}>
            <h3>Modal</h3>
            <p>New modal system.</p>
            <button className="ui-btn ui-btn-primary" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function ToastStack() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="ui-toast-stack">
      {toasts.map(toast => (
        <button key={toast.id} className="ui-toast" onClick={() => dismiss(toast.id)}>
          {toast.message}
        </button>
      ))}
    </div>
  );
}
