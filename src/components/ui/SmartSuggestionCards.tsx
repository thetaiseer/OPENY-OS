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

  const visible = useMemo(() => items.filter((item) => !dismissed.includes(item.id)), [items, dismissed]);
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    setDismissed((previous) => {
      const next = [...previous, id];
      if (typeof window !== 'undefined') window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((item) => (
        <article key={item.id} className="rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{item.title}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="rounded-md p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)]"
              aria-label="Dismiss suggestion"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">{item.description}</p>
          {item.action ? <div className="mt-2">{item.action}</div> : null}
        </article>
      ))}
    </section>
  );
}
