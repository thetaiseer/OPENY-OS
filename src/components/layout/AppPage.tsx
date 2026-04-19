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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('os-page', fullWidth && 'os-page--full', fill && 'os-page--fill', className)}
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
    <header className={clsx('os-page-header', className)}>
      <div>
        <h1 className="os-page-title">{title}</h1>
        {subtitle ? <p className="os-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
