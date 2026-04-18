'use client';

import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2 } from 'lucide-react';
import AppSidebar from './AppSidebar';

const docsNav = [
  { href: '/docs/documents/invoice', label: 'Invoice', icon: FileText },
  { href: '/docs/documents/quotation', label: 'Quotation', icon: ClipboardList },
  { href: '/docs/documents/client-contract', label: 'Client Contract', icon: FileSignature },
  { href: '/docs/documents/hr-contract', label: 'HR Contract', icon: BookOpen },
  { href: '/docs/documents/employees', label: 'Employees', icon: Users },
  { href: '/docs/documents/accounting', label: 'Accounting', icon: BarChart2 },
];

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function DocsSidebar({ open, onClose }: DocsSidebarProps) {
  const items = docsNav.map(({ href, label, icon }) => ({ href, base: href, label, icon }));
  return <AppSidebar items={items} open={open} onClose={onClose} workspaceTag="DOCS" variant="docs" />;
}
