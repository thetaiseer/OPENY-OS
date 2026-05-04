'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { ArrowLeft, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabButton } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import OpenyLogo from '@/components/branding/OpenyLogo';

const DOC_TYPE_LINKS = [
  { href: '/docs/invoice', label: 'Invoice', key: 'invoice' },
  { href: '/docs/quotation', label: 'Quotation', key: 'quotation' },
  { href: '/docs/client-contract', label: 'Client Contract', key: 'client-contract' },
  { href: '/docs/hr-contract', label: 'HR Contract', key: 'hr-contract' },
  { href: '/docs/employees', label: 'Employees', key: 'employees' },
  { href: '/docs/accounting', label: 'Accounting', key: 'accounting' },
] as const;

export type DocsDocTypeTabKey = (typeof DOC_TYPE_LINKS)[number]['key'] | 'home';

export function DocsDocTypeTabs({ active }: { active: DocsDocTypeTabKey }) {
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

export function DocsHomeButton() {
  return (
    <Link href="/docs" className="docs-home-btn" title="Back to Docs Home">
      <Home size={14} />
      <span>Home</span>
    </Link>
  );
}

export function DocsOsButton() {
  return (
    <Link href="/os/dashboard" className="docs-home-btn docs-os-btn" title="Back to OPENY OS">
      <ArrowLeft size={14} />
      <span>Back to OS</span>
    </Link>
  );
}

/** Two-row toolbar: doc-type tabs + actions + home button, then optional metadata / quick fields (shared across Docs workspaces). */
export function DocsToolbarLayout({
  navigation,
  actions,
  children,
}: {
  navigation: ReactNode;
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="docs-workspace-quickbar">
      <div className="docs-toolbar-top-row">
        <div className="docs-toolbar-brand">
          <OpenyLogo width={210} height={54} forceVariant="light" />
        </div>
        <div className="docs-toolbar-nav">{navigation}</div>
        <div className="docs-toolbar-actions">
          {actions}
          <DocsOsButton />
          <DocsHomeButton />
        </div>
      </div>
      {children != null && children !== false ? (
        <div className="docs-toolbar-meta">{children}</div>
      ) : null}
    </div>
  );
}

function subscribeLg(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(min-width: 1024px)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}

function getLgSnapshot() {
  return window.matchMedia('(min-width: 1024px)').matches;
}

function getLgServerSnapshot() {
  return true;
}

function useIsLargeScreen() {
  return useSyncExternalStore(subscribeLg, getLgSnapshot, getLgServerSnapshot);
}

type MobilePanel = 'edit' | 'preview' | 'history';

export function DocsWorkspaceShell({
  toolbar,
  editor,
  preview,
  history,
  shellClassName,
}: {
  toolbar: ReactNode;
  editor: ReactNode;
  preview: ReactNode;
  history?: ReactNode;
  shellClassName?: string;
}) {
  const isLg = useIsLargeScreen();
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('edit');
  const hasHistory = Boolean(history);

  return (
    <div className={cn('docs-workspace-shell', shellClassName)}>
      <div className="docs-workspace">
        <header className="docs-workspace-toolbar">{toolbar}</header>

        {!isLg ? (
          <div className="docs-workspace-mobile-tabs lg:hidden">
            <Tabs className="w-full justify-stretch sm:justify-center [&>button]:flex-1 sm:[&>button]:flex-none">
              <TabButton
                type="button"
                active={mobilePanel === 'edit'}
                onClick={() => setMobilePanel('edit')}
              >
                Edit
              </TabButton>
              <TabButton
                type="button"
                active={mobilePanel === 'preview'}
                onClick={() => setMobilePanel('preview')}
              >
                Preview
              </TabButton>
              {hasHistory ? (
                <TabButton
                  type="button"
                  active={mobilePanel === 'history'}
                  onClick={() => setMobilePanel('history')}
                >
                  History
                </TabButton>
              ) : null}
            </Tabs>
          </div>
        ) : null}

        <div
          className={clsx(
            'docs-workspace-body',
            isLg ? 'docs-workspace-body-desktop' : 'docs-workspace-body-mobile',
          )}
        >
          <section
            className={clsx(
              'docs-workspace-editor',
              !isLg && mobilePanel !== 'edit' && 'docs-workspace-panel-hidden-mobile',
            )}
          >
            {editor}
          </section>

          <div className="docs-workspace-aside">
            <div
              className={clsx(
                'docs-workspace-preview-slot',
                !isLg && mobilePanel !== 'preview' && 'docs-workspace-preview-offscreen',
              )}
            >
              <aside className="docs-workspace-preview">{preview}</aside>
            </div>

            {history ? (
              <aside
                className={clsx(
                  'docs-workspace-history',
                  !isLg && mobilePanel !== 'history' && 'docs-workspace-panel-hidden-mobile',
                )}
              >
                {history}
              </aside>
            ) : null}
          </div>
        </div>
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
