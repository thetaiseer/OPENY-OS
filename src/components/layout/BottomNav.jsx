"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, CalendarDays, Users2, CheckSquare, Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const items = [
  { href: "/", labelKey: "nav.home", icon: LayoutDashboard },
  { href: "/clients", labelKey: "nav.clients", icon: Users2 },
  { href: "/content", labelKey: "nav.content", icon: CalendarDays },
  { href: "/tasks", labelKey: "nav.tasks", icon: CheckSquare },
  { href: "/publishing", labelKey: "nav.publishing", icon: Globe }];


  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 z-40 lg:hidden"
      style={{
        background: "#ffffff",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -4px 24px rgba(15,23,42,0.06), 0 -1px 0 var(--border)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
        paddingTop: "6px",
        minHeight: "var(--bottomnav-height)"
      }}>
      
      {items.map(({ href, labelKey, icon: Icon }) => {
        const isActive = pathname === href || href !== "/" && pathname.startsWith(href);
        return (
          <motion.div key={href} whileTap={{ scale: 0.88 }}>
            <Link
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[56px] min-h-[48px] justify-center relative"
              style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}>
              
              <Icon size={20} />
              <span className="text-[10px] font-semibold leading-tight">
                {t(labelKey)}
              </span>
              {isActive &&
              <motion.span
                layoutId="bottom-nav-dot"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                style={{ background: "var(--accent)" }}
                transition={{ type: "spring", stiffness: 480, damping: 38 }} />

              }
            </Link>
          </motion.div>);

      })}
    </nav>);

}