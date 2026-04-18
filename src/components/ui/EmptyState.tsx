import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  suggestions?: Array<{
    title: string;
    description?: string;
    action?: React.ReactNode;
  }>;
}

export default function EmptyState({ icon: Icon, title, description, action, suggestions }: EmptyStateProps) {
  return (
    <div className="animate-openy-fade-in openy-card openy-empty-state rounded-2xl border p-8 text-center">
      <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-2)]">
        <Icon size={26} style={{ color: 'var(--accent-secondary)' }} />
      </div>

      <h3 className="text-base font-bold tracking-tight">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}

      {suggestions && suggestions.length > 0 ? (
        <div className="mx-auto mt-6 grid max-w-3xl gap-2.5 text-left md:grid-cols-2">
          {suggestions.map((suggestion) => (
            <div key={suggestion.title} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
              <p className="text-sm font-semibold">{suggestion.title}</p>
              {suggestion.description ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{suggestion.description}</p> : null}
              {suggestion.action ? <div className="mt-2">{suggestion.action}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
