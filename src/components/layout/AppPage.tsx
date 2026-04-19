import { ReactNode } from 'react';

interface AppPageProps {
  /** Page title shown in the header */
  title: string;
  /** Optional supporting subtitle */
  subtitle?: string;
  /** Optional actions rendered on the right side of the page header */
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={clsx('app-page', fullWidth && 'app-page-full', fill && 'app-page-fill', className)}
    >
      {children}
    </motion.section>
  );
}

interface AppPageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * AppPage — page-level layout wrapper.
 * Provides a consistent page header (title, subtitle, actions) above page content.
 */
export function AppPage({ title, subtitle, actions, children }: AppPageProps) {
  return (
    <>
      <div className="ui-page-header">
        <div>
          <h1 className="ui-title">{title}</h1>
          {subtitle && <p className="ui-subtitle">{subtitle}</p>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{actions}</div>}
      </div>
      {children}
    </>
  );
}
