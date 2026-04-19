import type { ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps {
  children?: ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return <section className={clsx('ds-card', className)}>{children}</section>;
}
