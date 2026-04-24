'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { PageShell } from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

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
    <PageShell className="max-w-[96rem]">
      <div className="docs-workspace">
        <header className="docs-workspace-toolbar">{toolbar}</header>
        <div className="docs-workspace-body">
          <section className="docs-workspace-editor">{editor}</section>
          <aside className="docs-workspace-preview">{preview}</aside>
        </div>
      </div>
    </PageShell>
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
    <section className={clsx('openy-motion-card', compact && 'docs-editor-card-compact')}>
      <Card padding={compact ? 'sm' : 'md'} className="!rounded-2xl">
        <CardHeader className="!mb-3">
          <CardTitle className="!text-xs !font-bold !uppercase !tracking-wider !text-[var(--text-secondary)]">
            {title}
          </CardTitle>
          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </section>
  );
}
