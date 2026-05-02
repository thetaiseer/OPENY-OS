'use client';

import Link from 'next/link';
import {
  FileText,
  ClipboardList,
  FileSignature,
  BookOpen,
  Users,
  BarChart2,
  ArrowRight,
} from 'lucide-react';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';
import { cn } from '@/lib/cn';
import { useLang } from '@/context/lang-context';

const CLIENT_MODULES = [
  {
    step: 1,
    href: '/docs/quotation',
    icon: ClipboardList,
    labelKey: 'docModuleQuotation',
    descKey: 'docModuleQuotationDesc',
  },
  {
    step: 2,
    href: '/docs/client-contract',
    icon: FileSignature,
    labelKey: 'docModuleClientContract',
    descKey: 'docModuleClientContractDesc',
  },
  {
    step: 3,
    href: '/docs/invoice',
    icon: FileText,
    labelKey: 'docModuleInvoice',
    descKey: 'docModuleInvoiceDesc',
  },
] as const;

const OPS_MODULES = [
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

function ModuleCard({
  href,
  icon: Icon,
  label,
  desc,
  step,
  isLast,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  step?: number;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex items-stretch gap-0">
      <Link
        href={href}
        className={cn(
          'group relative flex flex-1 items-start gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 no-underline shadow-card transition-all duration-200 ease-out',
          'hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:shadow-lg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
          'active:translate-y-0 active:scale-[0.99]',
        )}
      >
        {step !== undefined && (
          <span className="absolute end-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--accent-soft)] text-[10px] font-bold text-[color:var(--accent)]">
            {step}
          </span>
        )}
        <span
          className="group-hover:border-[color:var(--accent)]/30 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color:var(--surface-elevated)] text-[color:var(--accent)] transition-colors group-hover:bg-[color:var(--accent-soft)]"
          aria-hidden
        >
          <Icon size={20} strokeWidth={2} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pe-4">
          <span className="text-sm font-semibold text-primary transition-colors group-hover:text-[color:var(--accent)]">
            {label}
          </span>
          <span className="text-xs leading-snug text-secondary">{desc}</span>
        </div>
      </Link>

      {step !== undefined && !isLast && (
        <span className="pointer-events-none absolute -end-[18px] top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center xl:flex">
          <ArrowRight size={14} className="text-[var(--border)]" />
        </span>
      )}
    </div>
  );
}

export default function DocsHomePage() {
  const { t } = useLang();
  return (
    <PageShell className="max-w-5xl space-y-8">
      <PageHeader title={t('docs')} subtitle={t('docsHomeSubtitle')} />

      {/* Client documents — sequential workflow */}
      <section className="space-y-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-primary">{t('docsGroupClientDocs')}</h2>
          <p className="text-xs text-secondary">{t('docsGroupClientDocsSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:gap-5">
          {CLIENT_MODULES.map(({ href, icon, labelKey, descKey, step }, i) => (
            <ModuleCard
              key={href}
              href={href}
              icon={icon}
              label={t(labelKey)}
              desc={t(descKey)}
              step={step}
              isLast={i === CLIENT_MODULES.length - 1}
            />
          ))}
        </div>
      </section>

      {/* Operations */}
      <section className="space-y-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-semibold text-primary">{t('docsGroupOperations')}</h2>
          <p className="text-xs text-secondary">{t('docsGroupOperationsSubtitle')}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPS_MODULES.map(({ href, icon, labelKey, descKey }) => (
            <ModuleCard key={href} href={href} icon={icon} label={t(labelKey)} desc={t(descKey)} />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
