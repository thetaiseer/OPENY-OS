'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { buildBreadcrumbs } from '@/lib/navigation/routes';

type BreadcrumbsProps = {
  className?: string;
  hideOnDashboard?: boolean;
};

export default function Breadcrumbs({ className, hideOnDashboard = true }: BreadcrumbsProps) {
  const pathname = usePathname();
  const items = buildBreadcrumbs(pathname);
  const isDashboardOnly = items.length === 1 && items[0].href === '/dashboard';

  if (items.length === 0) return null;
  if (hideOnDashboard && isDashboardOnly) return null;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-secondary sm:text-sm">
        {items.map((item, index) => {
          const showDivider = index > 0;
          return (
            <li key={item.key} className="inline-flex items-center gap-1">
              {showDivider ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
              {item.isCurrent ? (
                <span aria-current="page" className="font-medium text-primary">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-primary hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
