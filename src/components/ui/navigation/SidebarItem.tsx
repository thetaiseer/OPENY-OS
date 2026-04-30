'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

type SidebarItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  aliases?: string[];
};

export default function SidebarItem({ href, label, icon: Icon, aliases = [] }: SidebarItemProps) {
  const pathname = usePathname();
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';
  const normalizedHref = href.replace(/\/+$/, '') || '/';
  const baseActive =
    normalizedPathname === normalizedHref || normalizedPathname.startsWith(`${normalizedHref}/`);
  const aliasActive = aliases.some((alias) => {
    const normalizedAlias = alias.replace(/\/+$/, '') || '/';
    return (
      normalizedPathname === normalizedAlias || normalizedPathname.startsWith(`${normalizedAlias}/`)
    );
  });
  const isActive = baseActive || aliasActive;

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={clsx(
        'group flex items-center gap-3 rounded-lg border-l-4 px-4 py-2 transition-all duration-150',
        isActive
          ? 'border-l-[var(--sidebar-active)] bg-[var(--sidebar-active)] text-[var(--sidebar-active-foreground)] shadow-[0_10px_24px_var(--openy-glow)]'
          : 'border-l-transparent text-[var(--sidebar-foreground)] hover:bg-[color:var(--surface-soft)]',
      )}
    >
      <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-current')} />
      <span className="truncate text-sm font-medium">{label}</span>
    </Link>
  );
}
