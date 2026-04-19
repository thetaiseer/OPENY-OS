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
    <div className="animate-openy-fade-in flex flex-col items-center justify-center gap-5 rounded-3xl border px-8 py-16 text-center backdrop-blur-xl" style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(5,5,5,0.68)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 28px 64px rgba(0,0,0,0.58)' }}>
      <div
        className="inline-flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--accent)', border: '1px solid rgba(255,255,255,0.14)' }}
      >
        <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
      </div>

      <div>
        <h3 className="text-[19px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      </div>

      {action ? <div>{action}</div> : null}

      {suggestions && suggestions.length > 0 ? (
        <div className="mx-auto mt-2 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.title}
              className="rounded-2xl border p-4"
              style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
            >
              <p className="text-[13px] font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {suggestion.title}
              </p>
              {suggestion.description ? (
                <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
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
