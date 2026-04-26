'use client';

import { isValidElement, type ElementType, type ReactNode } from 'react';

export default function EmptyState({
  children,
  title,
  description,
  icon,
  action,
}: {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode | ElementType;
  action?: ReactNode;
  [key: string]: unknown;
}) {
  const renderedIcon = (() => {
    if (!icon) return null;
    if (isValidElement(icon)) return icon;

    // Support passing icon={Users} and icon={<Users />} interchangeably.
    const maybeObject = icon as unknown;
    if (
      typeof icon === 'function' ||
      (typeof maybeObject === 'object' &&
        maybeObject !== null &&
        '$$typeof' in (maybeObject as Record<string, unknown>))
    ) {
      const Icon = icon as ElementType;
      return <Icon className="h-5 w-5" />;
    }

    // Avoid rendering plain objects as children.
    if (typeof icon === 'object') return null;

    return icon as ReactNode;
  })();

  return (
    <div className="openy-surface flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      {renderedIcon ? (
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
          {renderedIcon}
        </div>
      ) : null}
      {title ? (
        <div className="text-base font-semibold text-[color:var(--text-primary)]">{title}</div>
      ) : null}
      {description ? (
        <div className="max-w-xl text-sm font-medium leading-relaxed text-[color:var(--text-secondary)]">
          {description}
        </div>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
      {children}
    </div>
  );
}
