"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users2, UserCircle, CheckSquare, Settings2, Globe, CalendarDays, ClipboardCheck, ImageIcon, BarChart2, Send } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";

export function SideNav() {
  const pathname = usePathname();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { theme } = useTheme();

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/clients", label: t("nav.clients"), icon: Users2 },
    { href: "/content", label: t("nav.content"), icon: CalendarDays },
    { href: "/tasks", label: t("nav.tasks"), icon: CheckSquare },
    { href: "/approvals", label: t("nav.approvals"), icon: ClipboardCheck },
    { href: "/team", label: t("nav.team"), icon: UserCircle },
    { href: "/assets", label: t("nav.assets"), icon: ImageIcon },
    { href: "/reports", label: t("nav.reports"), icon: BarChart2 },
    { href: "/publishing", label: t("nav.publishing"), icon: Send },
    { href: "/settings", label: t("nav.settings"), icon: Settings2 },
  ];

  return (
    <aside
      className="fixed top-0 h-full w-[220px] flex flex-col z-40"
      style={{
        background: 'var(--glass-nav)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderInlineEnd: '1px solid var(--border)',
        boxShadow: 'var(--shadow-nav)',
        [isRTL ? 'right' : 'left']: 0,
      }}
    >
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center">
          <img
            src={theme === "light" ? "/assets/logo-light.png" : "/assets/logo-dark.png"}
            alt="OPENY OS"
            height={36}
            style={{ height: 36, width: "auto", objectFit: "contain" }}
          />
        </div>
      </div>
      
      <div className="mx-4 mb-4" style={{ height: '1px', background: 'var(--border)' }} />
      
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <motion.div
              key={href}
              whileHover={{ x: isRTL ? -2 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <Link
                href={href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150"
                style={{
                  background: isActive ? 'var(--glass-nav-active)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  boxShadow: isActive ? `inset 0 0 0 1px var(--glass-nav-active-border)` : 'none',
                }}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="text-sm font-medium">{label}</span>
                {isActive && (
                  <motion.div
                    className="ms-auto w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--accent)' }}
                    layoutId="nav-dot"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div className="px-3 mb-3">
        <motion.button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{
            background: 'var(--glass-overlay)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--glass-overlay-border)',
          }}
          whileHover={{ background: 'var(--surface-3)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Globe size={17} className="flex-shrink-0" />
          <span className="text-sm font-medium">
            {language === "en" ? "العربية" : "English"}
          </span>
        </motion.button>
      </div>
      
      <div
        className="mx-3 mb-4 p-3 rounded-xl flex items-center gap-2.5"
        style={{ background: 'var(--glass-overlay)', border: '1px solid var(--glass-overlay-border)' }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>
          A
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>Alex Chen</p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Admin</p>
        </div>
      </div>
    </aside>
  );
}

