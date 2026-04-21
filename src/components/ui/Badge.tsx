type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variants: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default: { bg: 'var(--surface-2)',                   color: 'var(--text-secondary)',   border: 'var(--border)' },
  success: { bg: 'var(--color-success-bg)',             color: 'var(--color-success)',    border: 'var(--color-success-border)' },
  warning: { bg: 'var(--color-warning-bg)',             color: 'var(--color-warning)',    border: 'var(--color-warning-border)' },
  danger:  { bg: 'var(--color-danger-bg)',              color: 'var(--color-danger)',     border: 'var(--color-danger-border)' },
  info:    { bg: 'var(--color-info-bg)',                color: 'var(--color-info)',       border: 'var(--color-info-border)' },
};

interface BadgeProps { children: React.ReactNode; variant?: BadgeVariant; }

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  const style = variants[variant];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: style.bg, color: style.color, borderColor: style.border, boxShadow: 'var(--highlight-inset)' }}
    >
      {children}
    </span>
  );
}
