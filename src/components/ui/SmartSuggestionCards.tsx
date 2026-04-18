'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

interface SmartSuggestionCardsProps {
  storageKey: string;
  items: SuggestionItem[];
}

export default function SmartSuggestionCards({ storageKey, items }: SmartSuggestionCardsProps) {
  const [dismissed, setDismissed] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as string[];
    } catch {
      return [];
    }
  });

  const visible = useMemo(
    () => items.filter((item) => !dismissed.includes(item.id)),
    [items, dismissed],
  );

  if (visible.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((prev) => {
      const next = [...prev, id];
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
      {visible.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border p-3.5"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{item.title}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Dismiss suggestion"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {item.description}
          </p>
          {item.action && <div className="mt-2">{item.action}</div>}
        </div>
      ))}
    </div>
  );
}
