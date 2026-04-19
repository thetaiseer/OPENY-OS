import { ReactNode } from 'react';

interface AppPageProps {
  /** Page title shown in the header */
  title: string;
  /** Optional supporting subtitle */
  subtitle?: string;
  /** Optional actions rendered on the right side of the page header */
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
