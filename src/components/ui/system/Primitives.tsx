import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type CardVariant = 'default' | 'soft' | 'elevated';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface AppCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'section' | 'div';
  variant?: CardVariant;
}

const cardVariantClass: Record<CardVariant, string> = {
  default: 'app-card',
  soft: 'app-card bg-[var(--surface-2)]',
  elevated: 'app-card',
};

export function AppCard({ as = 'section', variant = 'default', className, ...props }: AppCardProps) {
  const Comp = as;
  return <Comp className={clsx(cardVariantClass[variant], className)} {...props} />;
}

export function SurfacePanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('surface-panel', className)} {...props} />;
}

interface SectionHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={clsx('section-header', className)}>
      <div>
        <h2 className="section-header__title">{title}</h2>
        {subtitle ? <p className="section-header__subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const buttonSizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'btn-icon',
};

export function ActionButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ActionButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      className={clsx('action-button', buttonVariantClass[variant], buttonSizeClass[size], className)}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({ className, ...props }: Omit<ActionButtonProps, 'size'>) {
  return <ActionButton size="icon" className={clsx('icon-button', className)} {...props} />;
}

interface StatCardProps {
  title: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function StatCard({ title, value, meta, icon, action, className }: StatCardProps) {
  return (
    <AppCard as="article" className={clsx('p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        {icon && (
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
            {icon}
          </div>
        )}
        {action}
      </div>
      <p className="text-xs font-medium text-[var(--text-secondary)]">{title}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--text-primary)]">{value}</p>
      {meta ? <p className="mt-1 text-xs text-[var(--text-tertiary)]">{meta}</p> : null}
    </AppCard>
  );
}
