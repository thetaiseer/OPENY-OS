'use client';

import type { ReactNode } from 'react';

export default function EmptyState({
  children,
  title,
  description,
}: {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  [key: string]: any;
}) {
  return (
    <div>
      {title ? <div>{title}</div> : null}
      {description ? <div>{description}</div> : null}
      {children}
    </div>
  );
}
