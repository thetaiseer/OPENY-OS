'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface AppPageProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  fill?: boolean;
}

export function AppPage({ children, className, fullWidth = false, fill = false }: AppPageProps) {
  const pathname = usePathname();
  return (
    <motion.section
      key={pathname}
      initial={{ opacity: 0, y: 12, x: 8 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.78, 0.2, 1] }}
      className={clsx('app-page openy-page-shell page-enter', fullWidth && 'app-page-full', fill && 'app-page-fill', className)}
    >
      {children}
    </motion.section>
  );
}

interface AppPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AppPageHeader({ title, subtitle, actions, className }: AppPageHeaderProps) {
  return (
    <header className={clsx('app-page-header', className)}>
      <div className="min-w-0">
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="app-page-actions">{actions}</div> : null}
    </header>
  );
}
