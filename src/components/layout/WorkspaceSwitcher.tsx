'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  plan?: string;
}

interface WorkspaceSwitcherProps {
  workspaces?: Workspace[];
  activeId?: string;
}

const DEMO_WORKSPACES: Workspace[] = [
  { id: 'main', name: 'Main Workspace', plan: 'Pro' },
  { id: 'client-a', name: 'Client A', plan: 'Standard' },
];

/**
 * WorkspaceSwitcher — dropdown for switching between workspaces.
 * Renders inside the sidebar footer or topbar area.
 */
export function WorkspaceSwitcher({
  workspaces = DEMO_WORKSPACES,
  activeId = 'main',
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(activeId);

  const active = workspaces.find(w => w.id === current) ?? workspaces[0];

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="ui-btn ui-btn-ghost"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          fontSize: 13,
          height: 36,
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--brand-soft)',
              border: '1px solid var(--border-brand)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--brand)',
              flexShrink: 0,
            }}
          >
            {active.name.charAt(0).toUpperCase()}
          </span>
          <span style={{ fontWeight: 600 }}>{active.name}</span>
        </span>
        <ChevronDown
          size={13}
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 150ms',
          }}
        />
        type="button"
        className="inline-flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-[var(--surface-2)]"
        style={{ color: 'var(--text-primary)' }}
        onClick={() => setOpen(value => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown size={13} className={open ? 'rotate-180 transition-transform shrink-0' : 'transition-transform shrink-0'} style={{ color: 'var(--text-secondary)' }} />
      </button>

      {open && (
        <div
          className="ui-card"
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 6,
            padding: 6,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            zIndex: 50,
          }}
          role="listbox"
        >
          {workspaces.map(ws => (
            <button
              key={ws.id}
              role="option"
              aria-selected={ws.id === current}
              className="ui-nav-item"
              data-active={ws.id === current}
              onClick={() => {
                setCurrent(ws.id);
                setOpen(false);
              }}
              style={{ justifyContent: 'space-between', textAlign: 'left' }}
            >
              <span>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ws.name}</div>
                {ws.plan && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ws.plan}</div>
                )}
              </span>
              {ws.id === current && <Check size={13} style={{ color: 'var(--brand)' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
