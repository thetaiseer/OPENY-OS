import Link from 'next/link';
import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2 } from 'lucide-react';

const items = [
  { href: '/docs/documents/invoice', icon: FileText, title: 'Invoice' },
  { href: '/docs/documents/quotation', icon: ClipboardList, title: 'Quotation' },
  { href: '/docs/documents/client-contract', icon: FileSignature, title: 'Client Contract' },
  { href: '/docs/documents/hr-contract', icon: BookOpen, title: 'HR Contract' },
  { href: '/docs/documents/employees', icon: Users, title: 'Employees' },
  { href: '/docs/documents/accounting', icon: BarChart2, title: 'Accounting' },
];

export default function DocsDocumentsPage() {
  return (
    <div className="p-6 sm:p-8">
      <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Documents</h1>
      <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>Owner-only business documentation modules.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 max-w-5xl">
        {items.map(({ href, icon: Icon, title }) => (
          <Link key={href} href={href} className="rounded-2xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <Icon size={20} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold mt-3" style={{ color: 'var(--text)' }}>{title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
