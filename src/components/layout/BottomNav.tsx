"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, CalendarDays, Users2, CheckSquare, ClipboardCheck } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
    { href: "/",          labelKey: "nav.home",      icon: LayoutDashboard },
    { href: "/clients",   labelKey: "nav.clients",   icon: Users2 },
    { href: "/content",   labelKey: "nav.content",   icon: CalendarDays },
    { href: "/tasks",     labelKey: "nav.tasks",     icon: CheckSquare },
    { href: "/approvals", labelKey: "nav.approvals", icon: ClipboardCheck },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 z-40"
      style={{
        background: 'rgba(17,17,24,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 8px)',
        paddingTop: '8px',
        minHeight: '56px',
      }}
    >
      {items.map(({ href, labelKey, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <motion.div key={href} whileTap={{ scale: 0.9 }}>
            <Link
              href={href}
              className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl min-w-[48px] min-h-[44px] justify-center relative"
              style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgba(79,142,247,0.12)' }}
                  layoutId="bottom-nav-bg"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon size={20} style={{ position: 'relative', zIndex: 1 }} />
              <span className="text-[10px] font-medium leading-tight" style={{ position: 'relative', zIndex: 1 }}>
                {t(labelKey)}
              </span>
            </Link>
          </motion.div>
        );
      })}
    </nav>
  );
}

