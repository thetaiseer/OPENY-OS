'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';

type PremiumCardVariant = 'default' | 'glass' | 'elevated';

interface PremiumCardProps extends HTMLMotionProps<'article'> {
  variant?: PremiumCardVariant;
  interactive?: boolean;
}

const variantClasses: Record<PremiumCardVariant, string> = {
  default: 'rounded-3xl border border-black/[0.06] bg-white/95 shadow-sm dark:border-white/10 dark:bg-[#0A0A0A]',
  glass: 'rounded-3xl border border-black/[0.06] bg-white/90 shadow-md backdrop-blur-2xl dark:border-white/5 dark:bg-[#0A0A0A]/90',
  elevated: 'rounded-3xl border border-black/[0.06] bg-white shadow-md dark:border-white/10 dark:bg-[#0A0A0A]',
};

export default function PremiumCard({
  variant = 'default',
  interactive = false,
  className,
  children,
  onKeyDown,
  onClick,
  ...props
}: PremiumCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (!interactive || !onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(event as unknown as ReactMouseEvent<HTMLElement, MouseEvent>);
    }
  };

  return (
    <motion.article
      layout
      whileTap={interactive ? { scale: 0.98 } : undefined}
      whileHover={interactive ? { y: -2 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={clsx('p-6 transition-shadow duration-200', variantClasses[variant], interactive && 'cursor-pointer', className)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      {...props}
    >
      {children}
    </motion.article>
  );
}
