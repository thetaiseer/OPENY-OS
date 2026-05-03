'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const variants = {
  initial: { opacity: 0, filter: 'blur(4px)', scale: 0.98, y: 4 },
  animate: { opacity: 1, filter: 'blur(0px)', scale: 1, y: 0 },
  exit: { opacity: 0, filter: 'blur(3px)', scale: 0.99, y: -4 },
};

const reducedVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export default function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();
  const activeVariants = prefersReduced ? reducedVariants : variants;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={activeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: prefersReduced ? 0.12 : 0.18,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
