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
    if (typeof icon === 'function' || typeof icon === 'object') {
      const Icon = icon as ElementType;
      return <Icon className="h-5 w-5" />;
    }

    return icon;
  })();

  return (
    <div>
      {renderedIcon ? <div>{renderedIcon}</div> : null}
      {title ? <div>{title}</div> : null}
      {description ? <div>{description}</div> : null}
      {action ? <div>{action}</div> : null}
      {children}
    </div>
  );
}
