'use client';

import Link from 'next/link';
import { ClipboardList, FileText, Users, Briefcase, Calculator } from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';

const DOC_TYPES = [
  {
    href: '/docs/invoice',
    icon: FileText,
    iconBg: '#4F6EF7',
    label: 'Invoice',
    description:
      'Create professional invoices with campaign budget breakdown and platform allocation.',
    cta: 'Open Invoice',
    ctaColor: '#4F6EF7',
  },
  {
    href: '/docs/quotation',
    icon: ClipboardList,
    iconBg: '#4F6EF7',
    label: 'Quotation',
    description:
      'Generate detailed service quotations with deliverables, pricing, and terms & conditions.',
    cta: 'Open Quotation',
    ctaColor: '#4F6EF7',
  },
  {
    href: '/docs/client-contract',
    icon: Users,
    iconBg: '#22C55E',
    label: 'Client Contract',
    description:
      'Draft comprehensive client service agreements with legal clauses and digital marketing scope.',
    cta: 'Open Client Contract',
    ctaColor: '#22C55E',
  },
  {
    href: '/docs/hr-contract',
    icon: Briefcase,
    iconBg: '#F97316',
    label: 'HR Contract',
    description:
      'Create employment contracts with salary, job details, benefits, and legal terms for HR.',
    cta: 'Open HR Contract',
    ctaColor: '#F97316',
  },
  {
    href: '/docs/employees',
    icon: Users,
    iconBg: '#8B5CF6',
    label: 'Employees',
    description:
      'Manage employees, track salaries, link HR contracts, and monitor payroll & history.',
    cta: 'Open Employees',
    ctaColor: '#8B5CF6',
  },
  {
    href: '/docs/accounting',
    icon: Calculator,
    iconBg: '#0D9488',
    label: 'Accounting',
    description:
      'Track client collections, Egypt & overseas collections, expenses, and view financial summaries.',
    cta: 'Open Accounting',
    ctaColor: '#0D9488',
  },
] as const;

export default function DocsPage() {
  return (
    <div className="flex min-h-full flex-col items-center px-6 py-10">
      <div className="mb-10 flex flex-col items-center gap-3">
        <OpenyLogo width={140} height={36} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Select a document type to get started
        </p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        {DOC_TYPES.map((doc) => {
          const Icon = doc.icon;
          return (
            <div
              key={doc.href}
              className="flex flex-col gap-3 rounded-2xl border p-6"
              style={{
                borderColor: 'var(--border)',
                background: 'var(--surface)',
              }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: doc.iconBg }}
              >
                <Icon size={22} color="#fff" />
              </div>
              <div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
                  {doc.label}
                </h3>
                <p
                  className="mt-1 text-sm leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {doc.description}
                </p>
              </div>
              <Link
                href={doc.href}
                className="mt-auto inline-flex items-center gap-1 text-sm font-semibold"
                style={{ color: doc.ctaColor }}
              >
                {doc.cta} <span aria-hidden>›</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
