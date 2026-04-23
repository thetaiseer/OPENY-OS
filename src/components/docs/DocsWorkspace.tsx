'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';

const DOC_TYPE_LINKS = [
  { href: '/docs/invoice', label: 'Invoice', key: 'invoice' },
  { href: '/docs/quotation', label: 'Quotation', key: 'quotation' },
  { href: '/docs/client-contract', label: 'Client Contract', key: 'client-contract' },
  { href: '/docs/hr-contract', label: 'HR Contract', key: 'hr-contract' },
  { href: '/docs/employees', label: 'Employees', key: 'employees' },
  { href: '/docs/accounting', label: 'Accounting', key: 'accounting' },
] as const;

export function DocsDocTypeTabs({ active }: { active: (typeof DOC_TYPE_LINKS)[number]['key'] }) {
  return (
    <div className="docs-toolbar-tabs" role="tablist" aria-label="Document type">
      {DOC_TYPE_LINKS.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={clsx('docs-toolbar-tab', item.key === active && 'docs-toolbar-tab-active')}
          role="tab"
          aria-selected={item.key === active}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function DocsWorkspaceShell({
  toolbar,
  editor,
  preview,
}: {
  toolbar: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="docs-app docs-workspace">
      <header className="docs-workspace-toolbar">{toolbar}</header>
      <div className="docs-workspace-body">
        <section className="docs-workspace-editor">{editor}</section>
        <aside className="docs-workspace-preview">{preview}</aside>
      </div>
    </div>
  );
}

export function DocsEditorCard({
  title,
  children,
  actions,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={clsx('docs-editor-card', compact && 'docs-editor-card-compact')}>
      <div className="docs-editor-card-header">
        <h3>{title}</h3>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
