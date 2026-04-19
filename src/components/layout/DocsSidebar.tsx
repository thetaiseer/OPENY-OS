'use client';

import { FileText, ClipboardList, FileSignature, BookOpen, Users, BarChart2 } from 'lucide-react';
import AppSidebar, { type AppSidebarGroup } from './AppSidebar';

const docsGroups: AppSidebarGroup[] = [
  {
    label: 'Documents',
    items: [
      { href: '/docs/documents/invoice',         base: '/docs/documents/invoice',         label: 'Invoice',         icon: FileText       },
      { href: '/docs/documents/quotation',       base: '/docs/documents/quotation',       label: 'Quotation',       icon: ClipboardList  },
      { href: '/docs/documents/client-contract', base: '/docs/documents/client-contract', label: 'Client Contract', icon: FileSignature  },
      { href: '/docs/documents/hr-contract',     base: '/docs/documents/hr-contract',     label: 'HR Contract',     icon: BookOpen       },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/docs/documents/employees', base: '/docs/documents/employees', label: 'Employees', icon: Users },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/docs/documents/accounting', base: '/docs/documents/accounting', label: 'Accounting', icon: BarChart2 },
    ],
  },
];

interface DocsSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function DocsSidebar({ open, onClose }: DocsSidebarProps) {
  return (
    <AppSidebar
      groups={docsGroups}
      open={open}
      onClose={onClose}
      workspaceTag="DOCS"
      variant="docs"
    />
  );
}
