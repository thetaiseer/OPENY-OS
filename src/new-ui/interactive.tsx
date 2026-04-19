'use client';

import { useState } from 'react';
import { useToast } from '@/lib/toast-context';
import { ToastContainer } from '@/components/ui/ToastContainer';

export function Tabs({ items }: { items: string[] }) {
  const [active, setActive] = useState(items[0]);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(item => (
        <button
          key={item}
          className="ui-btn"
          onClick={() => setActive(item)}
          style={{
            height: 32,
            fontSize: 12,
            borderColor: active === item ? 'var(--border-brand)' : undefined,
            background: active === item ? 'var(--brand-soft)' : undefined,
            color: active === item ? 'var(--brand)' : undefined,
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function ActionMenu() {
  return (
    <details style={{ position: 'relative' }}>
      <summary
        className="ui-btn"
        style={{ listStyle: 'none', cursor: 'pointer' }}
      >
        Actions ▾
      </summary>
      <div
        className="ui-card"
        style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          minWidth: 160,
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          zIndex: 50,
        }}
      >
        <button className="ui-btn ui-btn-ghost" style={{ justifyContent: 'flex-start', width: '100%' }}>Edit</button>
        <button className="ui-btn ui-btn-ghost" style={{ justifyContent: 'flex-start', width: '100%' }}>Duplicate</button>
        <button className="ui-btn ui-btn-ghost" style={{ justifyContent: 'flex-start', width: '100%' }}>Archive</button>
      </div>
    </details>
  );
}

export function DemoModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="ui-btn" onClick={() => setOpen(true)}>Open Modal</button>
      {open && (
        <div
          className="ui-modal-backdrop"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="ui-modal">
            <div className="ui-modal-header">
              <div className="ui-modal-title">Modal</div>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              New modal — part of the redesigned UI system.
            </p>
            <div className="ui-modal-footer">
              <button className="ui-btn ui-btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="ui-btn ui-btn-primary" onClick={() => setOpen(false)}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** ToastStack — delegates to the canonical ToastContainer */
export function ToastStack() {
  return <ToastContainer />;
}
