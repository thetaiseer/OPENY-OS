import Link from 'next/link';
import { ReactNode } from 'react';

// Re-export AppShell from components so legacy imports keep working.
export { AppShell } from '@/components/layout/AppShell';

export type NavItem = { href: string; label: string };

export function Sidebar({ title, nav, activePath }: { title: string; nav: NavItem[]; activePath: string }) {
  return (
    <aside className="ui-sidebar">
      <div className="ui-sidebar-brand">
        <div className="ui-sidebar-logo">{title.charAt(0)}</div>
        <div>
          <div className="ui-sidebar-title">{title}</div>
          <div className="ui-sidebar-subtitle">Workspace</div>
        </div>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="ui-nav-item"
            data-active={activePath === item.href || activePath.startsWith(`${item.href}/`)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function Topbar({ label }: { label: string }) {
  return (
    <header className="ui-topbar">
      <div className="ui-topbar-left">
        <div className="ui-topbar-context">OPENY OS</div>
        <div className="ui-topbar-title">{label}</div>
      </div>
      <div className="ui-topbar-right">
        <button className="ui-btn">Search</button>
        <button className="ui-btn ui-btn-primary">New</button>
      </div>
    </header>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="ui-page-header">
      <div>
        <h1 className="ui-title">{title}</h1>
        <p className="ui-subtitle">{subtitle}</p>
      </div>
      {actions}
    </div>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <section className="ui-card">{children}</section>;
}

export function StatGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="ui-grid">
      {items.map(item => (
        <div key={item.label} className="ui-card ui-stat-card">
          <div className="ui-stat-label">{item.label}</div>
          <div className="ui-stat-value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <table className="ui-table">
      <thead>
        <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>{r.map((c, j) => <td key={`${i}-${j}`}>{c}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function FilterBar() {
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1.2fr 1fr 1fr auto' }}>
      <input className="ui-input" placeholder="Search…" />
      <select className="ui-select"><option>Status</option></select>
      <select className="ui-select"><option>Owner</option></select>
      <button className="ui-btn">Filter</button>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="ui-empty">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}
