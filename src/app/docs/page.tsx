import Link from 'next/link';
import {
  FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2,
} from 'lucide-react';

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
    <div className="app-page-shell max-w-5xl mx-auto">
      <div className="app-page-header">
        <div>
          <h1 className="app-page-title">DOCS</h1>
          <p className="app-page-subtitle">
            Internal business documents — invoices, contracts, employees &amp; accounting.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map(({ href, icon: Icon, label, description, color, bg }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-2xl p-5 border transition-all hover:shadow-md hover:-translate-y-0.5"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: bg }}>
              <Icon size={22} style={{ color }} strokeWidth={1.8} />
            </div>
            <h2
              className="text-base font-semibold mb-1.5 group-hover:text-[var(--accent)] transition-colors"
              style={{ color: 'var(--text)' }}
            >
              {label}
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
