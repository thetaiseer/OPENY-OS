'use client';

import {
  createContext,
  forwardRef,
  useContext,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { children?: ReactNode };
const PageShellContext = createContext(false);

export function PageShellProvider({ children }: { children?: ReactNode }) {
  return <PageShellContext.Provider value={true}>{children}</PageShellContext.Provider>;
}

export const PageShell = forwardRef<HTMLDivElement, DivProps>(function PageShell(
  { children, className, ...props },
  ref,
) {
  const hasGlobalShell = useContext(PageShellContext);

  if (hasGlobalShell) {
    return (
      <div ref={ref} {...props} className={cn('w-full space-y-6', className)}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      {...props}
      className={cn('mx-auto w-full max-w-shell space-y-6 px-6 pb-4 pt-6 md:pb-6', className)}
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
        {title ? <h1 className="openy-heading-1">{title}</h1> : null}
        {subtitle ? (
          <p className="text-sm leading-tight text-[color:var(--text-secondary)]">{subtitle}</p>
        ) : null}
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
      {title ? <Component className="openy-heading-2">{title}</Component> : null}
      {subtitle ? <p className="text-sm text-[color:var(--text-secondary)]">{subtitle}</p> : null}
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  actions,
  ...props
}: DivProps & { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div
      {...props}
      className={cn(
        'mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3',
        props.className,
      )}
    >
      <SectionTitle title={title} subtitle={subtitle} />
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
