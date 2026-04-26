'use client';

import Link from 'next/link';
import {
  FileText,
  ClipboardList,
  FileSignature,
  BookOpen,
  Users,
  BarChart2,
  ChevronRight,
} from 'lucide-react';
import { PageShell, PageHeader, SectionHeader } from '@/components/layout/PageLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { useLang } from '@/context/lang-context';

const MODULES = [
  {
    href: '/docs/invoice',
    icon: FileText,
    labelKey: 'docModuleInvoice',
    descKey: 'docModuleInvoiceDesc',
  },
  {
    href: '/docs/quotation',
    icon: ClipboardList,
    labelKey: 'docModuleQuotation',
    descKey: 'docModuleQuotationDesc',
  },
  {
    href: '/docs/client-contract',
    icon: FileSignature,
    labelKey: 'docModuleClientContract',
    descKey: 'docModuleClientContractDesc',
  },
  {
    href: '/docs/hr-contract',
    icon: BookOpen,
    labelKey: 'docModuleHrContract',
    descKey: 'docModuleHrContractDesc',
  },
  {
    href: '/docs/employees',
    icon: Users,
    labelKey: 'docModuleEmployees',
    descKey: 'docModuleEmployeesDesc',
  },
  {
    href: '/docs/accounting',
    icon: BarChart2,
    labelKey: 'docModuleAccounting',
    descKey: 'docModuleAccountingDesc',
  },
] as const;

export default function DocsHomePage() {
  const { t } = useLang();
  return (
    <PageShell className="max-w-6xl space-y-6">
      <PageHeader title={t('docs')} subtitle={t('docsHomeSubtitle')} />

      <Card padding="sm" className="sm:p-6">
        <CardContent className="space-y-5 !p-0">
          <SectionHeader
            title={t('docsDocumentModules')}
            subtitle={t('docsDocumentModulesSubtitle')}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ href, icon: Icon, labelKey, descKey }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'openy-motion-card shadow-card group flex min-h-[7.5rem] items-stretch gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 no-underline transition-all duration-200 ease-out',
                  'hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:shadow-lg',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
                  'active:translate-y-0 active:scale-[0.99]',
                )}
              >
                <span
                  className="group-hover:border-[color:var(--accent)]/30 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color:var(--surface-elevated)] text-[color:var(--accent)] transition-colors group-hover:bg-[color:var(--accent-soft)]"
                  aria-hidden
                >
                  <Icon size={22} strokeWidth={2} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pe-1">
                  <span className="text-base font-semibold text-primary transition-colors group-hover:text-[color:var(--accent)]">
                    {t(labelKey)}
                  </span>
                  <span className="text-sm leading-snug text-secondary">{t(descKey)}</span>
                </div>
                <span className="flex shrink-0 items-center self-center text-secondary transition-colors group-hover:text-[color:var(--accent)]">
                  <ChevronRight
                    className="h-5 w-5 opacity-50 group-hover:opacity-100 rtl:rotate-180"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
