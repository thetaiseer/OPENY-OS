import Link from 'next/link';
import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { cardSurfaceClass } from '@/components/ui/Card';
import { PageShell, PageHeader } from '@/components/layout/PageLayout';

const MODULES = [
  {
    href: '/docs/invoice',
    icon: FileText,
    label: 'Invoice',
    description: 'Generate, manage and export client invoices with platform budget allocation.',
    iconClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    href: '/docs/quotation',
    icon: ClipboardList,
    label: 'Quotation',
    description: 'Create professional quotations with deliverables, pricing and payment terms.',
    iconClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  {
    href: '/docs/client-contract',
    icon: FileSignature,
    label: 'Client Contract',
    description: 'Bilingual client agreements with legal clauses, services and signatures.',
    iconClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  },
  {
    href: '/docs/hr-contract',
    icon: BookOpen,
    label: 'HR Contract',
    description: 'Employee contracts with job details, salary, benefits and legal clauses.',
    iconClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  {
    href: '/docs/employees',
    icon: Users,
    label: 'Employees',
    description: 'Full employee management — profiles, payroll history and salary adjustments.',
    iconClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    href: '/docs/accounting',
    icon: BarChart2,
    label: 'Accounting',
    description: 'Client ledger, expenses and partner-based settlement summaries.',
    iconClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
];

export default function DocsHomePage() {
  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="DOCS"
        subtitle="Internal business documents — invoices, contracts, employees & accounting."
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(({ href, icon: Icon, label, description, iconClass }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              cardSurfaceClass,
              'openy-motion-card group block p-6 no-underline transition-transform duration-200 hover:-translate-y-1',
            )}
          >
            <div className="relative z-[1]">
              <div
                className={cn(
                  'ring-border/60 mb-5 flex h-12 w-12 items-center justify-center rounded-xl shadow-sm ring-1',
                  iconClass,
                )}
              >
                <Icon size={22} strokeWidth={2} />
              </div>
              <h2 className="app-card-title mb-1.5 transition-colors group-hover:text-[var(--accent)]">
                {label}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
