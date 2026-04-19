import type { ReactNode } from 'react';
import { AppCard } from '@/components/ui/system/Primitives';

interface CardProps {
  children?: ReactNode;
  className?: string;
}

export default function Card({ children, className }: CardProps) {
  return <AppCard className={className}>{children}</AppCard>;
}
