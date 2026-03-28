"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Megaphone, ClipboardCheck, Settings2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/",          labelKey: "nav.home",      icon: LayoutDashboard },
    { href: "/content",   labelKey: "nav.content",   icon: CalendarDays },
    { href: "/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
    { href: "/approvals", labelKey: "nav.approvals", icon: ClipboardCheck },
    { href: "/settings",  labelKey: "nav.settings",  icon: Settings2 },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 z-40"
      style={{
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingTop: '8px',
        minHeight: '56px',
      }}
    >
      {items.map(({ href, labelKey, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all min-w-[48px] min-h-[44px] justify-center"
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium leading-tight">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

