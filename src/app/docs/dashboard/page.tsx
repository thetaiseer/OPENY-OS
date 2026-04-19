'use client';

import Link from 'next/link';
import {
  FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2, ArrowRight,
} from 'lucide-react';
import OpenyLogo from '@/components/branding/OpenyLogo';

const MODULES = [
  {
    href:        '/docs/documents/invoice',
    icon:        FileText,
    label:       'Invoice',
    description: 'Generate, manage and export client invoices with platform budget allocation.',
    color:       '#3d9dff',
    bg:          'rgba(61,157,255,0.14)',
    border:      'rgba(61,157,255,0.28)',
  },
  {
    href:        '/docs/documents/quotation',
    icon:        ClipboardList,
    label:       'Quotation',
    description: 'Create professional quotations with deliverables, pricing and payment terms.',
    color:       '#56a8ff',
    bg:          'rgba(86,168,255,0.14)',
    border:      'rgba(86,168,255,0.28)',
  },
  {
    href:        '/docs/documents/client-contract',
    icon:        FileSignature,
    label:       'Client Contract',
    description: 'Bilingual client agreements with legal clauses, services and signatures.',
    color:       '#2f8bff',
    bg:          'rgba(47,139,255,0.14)',
    border:      'rgba(47,139,255,0.28)',
  },
  {
    href:        '/docs/documents/hr-contract',
    icon:        BookOpen,
    label:       'HR Contract',
    description: 'Employee contracts with job details, salary, benefits and legal clauses.',
    color:       '#4cb4ff',
    bg:          'rgba(76,180,255,0.14)',
    border:      'rgba(76,180,255,0.28)',
  },
  {
    href:        '/docs/documents/employees',
    icon:        Users,
    label:       'Employees',
    description: 'Full employee management — profiles, payroll history and salary adjustments.',
    color:       '#3792ff',
    bg:          'rgba(55,146,255,0.14)',
    border:      'rgba(55,146,255,0.28)',
  },
  {
    href:        '/docs/documents/accounting',
    icon:        BarChart2,
    label:       'Accounting',
    description: 'Client ledger, expenses and partner-based settlement summaries.',
    color:       '#7cc4ff',
    bg:          'rgba(124,196,255,0.14)',
    border:      'rgba(124,196,255,0.28)',
  },
];

export default function DocsLandingPage() {
  return (
    <div className="flex-1 overflow-y-auto p-5 sm:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <OpenyLogo width={110} height={32} />
            <span
              className="text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-md"
              style={{ color: 'var(--accent)', background: 'var(--accent-soft)', border: '1px solid var(--accent-glow)' }}
            >
              DOCS
            </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Internal business document platform — invoices, contracts, employees &amp; accounting.
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
        {MODULES.map(({ href, icon: Icon, label, description, color, bg, border }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl p-5 border transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
            style={{
              background:  'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: 'none',
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center border"
                style={{ background: bg, borderColor: border }}
              >
                <Icon size={21} style={{ color }} strokeWidth={1.8} />
              </div>
              <ArrowRight
                size={16}
                className="opacity-0 group-hover:opacity-100 transition-opacity mt-1"
                style={{ color }}
              />
            </div>
            <h2
              className="text-sm font-bold mb-1.5 group-hover:text-[var(--accent)] transition-colors tracking-tight"
              style={{ color: 'var(--text)' }}
            >
              {label}
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
