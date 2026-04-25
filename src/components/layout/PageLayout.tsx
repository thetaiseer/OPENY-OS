'use client';

import { forwardRef, type ElementType, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { children?: ReactNode };

export const PageShell = forwardRef<HTMLDivElement, DivProps>(function PageShell(
  { children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      {...props}
      className={cn('mx-auto w-full max-w-shell space-y-6 px-4 py-4 md:px-6', className)}
    >
      {children}
    </div>
  );
});

export function PageHeader({
  title,
  subtitle,
  actions,
  ...props
}: DivProps & { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div
      {...props}
      className={cn('flex flex-wrap items-start justify-between gap-3', props.className)}
    >
      <div className="space-y-1">
        {title ? <h1 className="text-2xl font-semibold text-primary">{title}</h1> : null}
        {subtitle ? <p className="text-sm text-secondary">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  as: Component = 'h2' as ElementType,
  children,
  ...props
}: DivProps & { title?: ReactNode; subtitle?: ReactNode; as?: ElementType }) {
  return (
    <div {...props} className={cn('space-y-1', props.className)}>
      {title ? <Component className="text-lg font-semibold text-primary">{title}</Component> : null}
      {subtitle ? <p className="text-sm text-secondary">{subtitle}</p> : null}
      {children}
    </div>
  );
}
