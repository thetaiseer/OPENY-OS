import Link from 'next/link';
import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2 } from 'lucide-react';

const items = [
  { href: '/docs/documents/invoice',         icon: FileText,      title: 'Invoice',         description: 'Create and manage client invoices' },
  { href: '/docs/documents/quotation',       icon: ClipboardList, title: 'Quotation',        description: 'Draft quotations for prospective clients' },
  { href: '/docs/documents/client-contract', icon: FileSignature, title: 'Client Contract',  description: 'Client service agreements' },
  { href: '/docs/documents/hr-contract',     icon: BookOpen,      title: 'HR Contract',      description: 'Employment and contractor agreements' },
  { href: '/docs/documents/employees',       icon: Users,         title: 'Employees',        description: 'Staff records and profiles' },
  { href: '/docs/documents/accounting',      icon: BarChart2,     title: 'Accounting',       description: 'Expense and revenue tracking' },
];

export default function DocsDocumentsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="docs-page-header mb-8">
        <div>
          <h1 className="docs-page-title">Documents</h1>
          <p className="docs-page-subtitle mt-1">Business documentation modules for owners and managers.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-xl border p-5 transition-all hover:-translate-y-0.5"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Icon size={18} />
            </div>
            <div>
              <h2 className="text-[14px] font-700 tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {title}
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
