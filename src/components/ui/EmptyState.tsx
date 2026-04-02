import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: 'var(--surface-2)' }}
      >
        <Icon size={28} style={{ color: 'var(--text-secondary)' }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
      <p className="text-sm max-w-sm mb-6" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      {action}
    </div>
  );
}
