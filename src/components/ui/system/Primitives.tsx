import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

type CardVariant = 'default' | 'stat' | 'info' | 'action' | 'soft' | 'elevated';
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
type IconBoxTone = 'accent' | 'neutral';

interface AppCardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'section' | 'div';
  variant?: CardVariant;
}

const cardVariantClass: Record<CardVariant, string> = {
  default: 'app-card app-card--info',
  stat: 'app-card app-card--stat',
  info: 'app-card app-card--info',
  action: 'app-card app-card--action',
  soft: 'app-card app-card--soft',
  elevated: 'app-card app-card--elevated',
};

export function AppCard({ as = 'section', variant = 'default', className, ...props }: AppCardProps) {
  const Comp = as;
  return <Comp className={clsx(cardVariantClass[variant], className)} {...props} />;
}

export function SurfacePanel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('surface-panel', className)} {...props} />;
}

interface IconBoxProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: IconBoxTone;
}

const iconBoxToneClass: Record<IconBoxTone, string> = {
  accent: 'icon-box--accent',
  neutral: 'icon-box--neutral',
};

export function IconBox({ tone = 'neutral', className, ...props }: IconBoxProps) {
  return <span className={clsx('icon-box', iconBoxToneClass[tone], className)} {...props} />;
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
      {loading ? <span className="action-button__spinner" aria-hidden="true" /> : null}
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
    <AppCard as="article" variant="stat" className={clsx('p-5', className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        {icon && (
          <div className="icon-box icon-box--accent">
            {icon}
          </div>
        )}
        {action}
      </div>
      <p className="card-meta">{title}</p>
      <p className="card-value">{value}</p>
      {meta ? <p className="card-meta card-meta--muted">{meta}</p> : null}
    </AppCard>
  );
}

interface InfoCardProps extends Omit<AppCardProps, 'variant'> {
  heading: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function InfoCard({ heading, description, actions, className, children, ...props }: InfoCardProps) {
  return (
    <AppCard variant="info" className={clsx('p-5', className)} {...props}>
      <div className="card-header">
        <div>
          <h3 className="card-title">{heading}</h3>
          {description ? <p className="card-body">{description}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </AppCard>
  );
}

interface ActionCardProps extends Omit<AppCardProps, 'variant'> {
  heading: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function ActionCard({ heading, description, action, icon, className, ...props }: ActionCardProps) {
  return (
    <AppCard variant="action" className={clsx('p-5', className)} {...props}>
      {icon ? <IconBox tone="accent">{icon}</IconBox> : null}
      <h3 className="card-title mt-4">{heading}</h3>
      {description ? <p className="card-body mt-2">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </AppCard>
  );
}
