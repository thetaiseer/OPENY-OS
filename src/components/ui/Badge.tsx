type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variants: Record<BadgeVariant, { bg: string; color: string; border: string }> = {
  default: { bg: 'var(--surface-2)', color: 'var(--text-secondary)', border: 'var(--border)' },
  success: { bg: 'rgba(16,185,129,0.12)', color: '#059669', border: 'rgba(16,185,129,0.25)' },
  warning: { bg: 'rgba(245,158,11,0.12)', color: '#d97706', border: 'rgba(245,158,11,0.25)' },
  danger:  { bg: 'rgba(239,68,68,0.12)', color: '#dc2626', border: 'rgba(239,68,68,0.25)' },
  info:    { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', border: 'rgba(59,130,246,0.25)' },
};

interface BadgeProps { children: React.ReactNode; variant?: BadgeVariant; }

export default function Badge({ children, variant = 'default' }: BadgeProps) {
  const style = variants[variant];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {children}
    </span>
  );
}
