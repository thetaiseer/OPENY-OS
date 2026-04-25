'use client';

import type { HTMLAttributes, ReactNode } from 'react';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children?: ReactNode;
  variant?: string;
};

export default function Badge({ children, ...props }: BadgeProps) {
  return <span {...props}>{children}</span>;
}
