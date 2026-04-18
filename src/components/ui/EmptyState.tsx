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
    <div className="animate-openy-fade-in flex flex-col items-center justify-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
      <div
        className="inline-flex h-12 w-12 items-center justify-center rounded-xl"
        style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
      >
        <Icon size={22} aria-hidden="true" />
      </div>

      <div>
        <h3 className="text-[15px] font-700 tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>

      {action ? <div>{action}</div> : null}

      {suggestions && suggestions.length > 0 ? (
        <div className="mx-auto mt-2 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.title}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3"
            >
              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                {suggestion.title}
              </p>
              {suggestion.description ? (
                <p className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  {suggestion.description}
                </p>
              ) : null}
              {suggestion.action ? <div className="mt-2">{suggestion.action}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
