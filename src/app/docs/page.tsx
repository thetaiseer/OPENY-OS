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
    color: '#2563eb',
    bg: 'rgba(37,99,235,0.08)',
  },
  {
    href: '/docs/quotation',
    icon: ClipboardList,
    label: 'Quotation',
    description: 'Create professional quotations with deliverables, pricing and payment terms.',
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.08)',
  },
  {
    href: '/docs/client-contract',
    icon: FileSignature,
    label: 'Client Contract',
    description: 'Bilingual client agreements with legal clauses, services and signatures.',
    color: '#0891b2',
    bg: 'rgba(8,145,178,0.08)',
  },
  {
    href: '/docs/hr-contract',
    icon: BookOpen,
    label: 'HR Contract',
    description: 'Employee contracts with job details, salary, benefits and legal clauses.',
    color: '#059669',
    bg: 'rgba(5,150,105,0.08)',
  },
  {
    href: '/docs/employees',
    icon: Users,
    label: 'Employees',
    description: 'Full employee management — profiles, payroll history and salary adjustments.',
    color: '#d97706',
    bg: 'rgba(217,119,6,0.08)',
  },
  {
    href: '/docs/accounting',
    icon: BarChart2,
    label: 'Accounting',
    description: 'Client ledger, expenses and partner-based settlement summaries.',
    color: '#dc2626',
    bg: 'rgba(220,38,38,0.08)',
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
        {MODULES.map(({ href, icon: Icon, label, description, color, bg }) => (
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
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{
                  background: `linear-gradient(145deg, ${bg} 0%, color-mix(in srgb, var(--surface-elevated) 88%, transparent) 100%)`,
                  boxShadow: `0 8px 18px ${bg}`,
                }}
              >
                <Icon size={22} style={{ color }} strokeWidth={2} />
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
