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
      className="rounded-2xl border flex flex-col items-center justify-center py-16 px-6 text-center"
      style={{
        background: 'var(--surface-glass)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        borderColor: 'var(--border-glass)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-2) 100%)',
          boxShadow: 'var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.5)',
          color: 'var(--accent)',
        }}
      >
        <Icon size={28} strokeWidth={1.8} />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h3>
      <p className="text-sm max-w-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      {action}
    </div>
  );
}
