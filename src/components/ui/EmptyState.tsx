import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4 animate-openy-fade-in">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 border"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Icon size={26} style={{ color: 'var(--text-tertiary)' }} />
      </div>
      <h3
        className="text-base font-bold mb-2 tracking-tight"
        style={{ color: 'var(--text)' }}
      >
        {title}
      </h3>
      <p
        className="text-sm max-w-xs mb-6 leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        {description}
      </p>
      {action}
    </div>
  );
}
