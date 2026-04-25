'use client';

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & { children?: ReactNode };

export const PageShell = forwardRef<HTMLDivElement, DivProps>(function PageShell(
  { children, ...props },
  ref,
) {
  return (
    <div ref={ref} {...props}>
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
    <div {...props}>
      {title ? <h1>{title}</h1> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  as: Component = 'h2',
  children,
  ...props
}: DivProps & { title?: ReactNode; subtitle?: ReactNode; as?: any }) {
  return (
    <div {...props}>
      {title ? <Component>{title}</Component> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {children}
    </div>
  );
}
