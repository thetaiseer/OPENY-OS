import { ReactNode } from 'react';

interface AppPageProps {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  fill?: boolean;
}

/**
 * AppPage — page-level layout wrapper.
 * Provides consistent padding and optional full-width/fill behaviour.
 */
export function AppPage({ children, className, fullWidth = false, fill = false }: AppPageProps) {
  const classes = [
    'app-page',
    fullWidth && 'app-page-full',
    fill && 'app-page-fill',
    className,
  ].filter(Boolean).join(' ');

  return <section className={classes}>{children}</section>;
}

