import Link from 'next/link';
import { ReactNode } from 'react';

export type NavItem = { href: string; label: string };

export function AppShell({ children, sidebar, topbar }: { children: ReactNode; sidebar: ReactNode; topbar: ReactNode }) {
  return (
    <div className="ui-shell">
      {sidebar}
      <main className="ui-main">
        {topbar}
        <div className="ui-content">{children}</div>
      </main>
    </div>
  );
}

export function Sidebar({ title, nav, activePath }: { title: string; nav: NavItem[]; activePath: string }) {
  return (
    <aside className="ui-sidebar">
      <div>
        <strong>{title}</strong>
        <p className="ui-subtitle">Rebuilt from zero</p>
      </div>
      <nav style={{ display: 'grid', gap: '8px' }}>
        {nav.map(item => (
          <Link key={item.href} href={item.href} className="ui-nav-item" data-active={activePath === item.href || activePath.startsWith(`${item.href}/`)}>
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
      <div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>Openy OS</div>
        <strong>{label}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="ui-btn">Search</button>
        <button className="ui-btn ui-btn-primary">Quick Action</button>
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
        <div key={item.label} className="ui-card" style={{ gridColumn: 'span 3' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>{item.label}</p>
          <h3 style={{ marginTop: 6 }}>{item.value}</h3>
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
        {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={`${i}-${j}`}>{c}</td>)}</tr>)}
      </tbody>
    </table>
  );
}

export function FilterBar() {
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: '1.2fr 1fr 1fr auto' }}>
      <input className="ui-input" placeholder="Search" />
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
      <p style={{ marginTop: 8 }}>{message}</p>
    </div>
  );
}
