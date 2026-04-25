'use client';

import type { HTMLAttributes, ReactNode } from 'react';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };

export const cardSurfaceClass = '';

export function Card({ children, ...props }: DivProps & { padding?: string }) {
  return <div {...props}>{children}</div>;
}

export function CardHeader({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}

export function CardTitle({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}

export function CardDescription({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}

export function CardContent({ children, ...props }: DivProps) {
  return <div {...props}>{children}</div>;
}
