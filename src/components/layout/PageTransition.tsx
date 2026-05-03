'use client';

import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const enterState = { opacity: 0, y: 4, filter: 'blur(1px)' };
const restState = { opacity: 1, y: 0, filter: 'blur(0px)' };

export default function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      // prefersReduced: skip initial state entirely so no animation plays
      initial={prefersReduced ? false : enterState}
      animate={restState}
      transition={{
        duration: 0.18,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
