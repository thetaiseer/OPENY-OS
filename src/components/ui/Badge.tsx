import { cn } from '@/lib/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]',
  success:
    'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
  warning:
    'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
  danger:
    'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info)] border-[var(--color-info-border)]',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
