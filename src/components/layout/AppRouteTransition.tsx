'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { motionTransition } from '@/lib/motion';

export default function AppRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const isDocsWorkspace = pathname.startsWith('/docs');

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{
          opacity: 0,
          scale: 0.99,
          x: isDocsWorkspace ? 18 : -18,
          y: 6,
          filter: 'blur(7px)',
        }}
        animate={{
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          filter: 'blur(0px)',
        }}
        exit={{
          opacity: 0.6,
          scale: 0.98,
          x: isDocsWorkspace ? -14 : 14,
          y: 0,
          filter: 'blur(7px)',
        }}
        transition={motionTransition.page}
        style={{ willChange: 'transform, opacity, filter' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
