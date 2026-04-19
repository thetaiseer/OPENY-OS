'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import type { ReactNode } from 'react';

type AnimatedButtonVariant = 'primary' | 'secondary' | 'ghost';

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: AnimatedButtonVariant;
}

const variantClasses: Record<AnimatedButtonVariant, string> = {
  primary: 'bg-black text-white shadow-sm hover:shadow-md dark:bg-white dark:text-black',
  secondary: 'border border-black/10 bg-white text-slate-900 shadow-sm hover:shadow-md dark:border-white/10 dark:bg-[#0A0A0A] dark:text-slate-100',
  ghost: 'bg-transparent text-slate-700 hover:bg-black/5 dark:text-slate-200 dark:hover:bg-white/10',
};

export default function AnimatedButton({ children, variant = 'primary', className, ...props }: AnimatedButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      whileHover={prefersReducedMotion ? undefined : { y: -1 }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      transition={prefersReducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 320, damping: 24 }}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:focus-visible:ring-white/20',
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
