import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl border px-6 py-16 text-center"
      style={{
        background: 'var(--surface-glass)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        borderColor: 'var(--border-glass)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-2) 100%)',
          boxShadow: 'var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.5)',
          color: 'var(--accent)',
        }}
      >
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h3
        className="mb-2 text-lg font-bold"
        style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}
      >
        {title}
      </h3>
      <p
        className="mb-6 max-w-sm text-sm leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}
