"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users2, UserCircle, CheckSquare, Settings2, Globe, CalendarDays, ClipboardCheck, ImageIcon, BarChart2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";

export function SideNav() {
  const pathname = usePathname();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { theme } = useTheme();

  const navSections = [
    {
      key: "workspace",
      label: t("nav.workspace"),
      items: [
        { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
      ],
    },
    {
      key: "operations",
      label: t("nav.operations"),
      items: [
        { href: "/clients", label: t("nav.clients"), icon: Users2 },
        { href: "/content", label: t("nav.content"), icon: CalendarDays },
        { href: "/tasks", label: t("nav.tasks"), icon: CheckSquare },
        { href: "/approvals", label: t("nav.approvals"), icon: ClipboardCheck },
      ],
    },
    {
      key: "team",
      label: t("nav.team_section"),
      items: [
        { href: "/team",   label: t("nav.team"),   icon: UserCircle },
        { href: "/assets", label: t("nav.assets"), icon: ImageIcon },
      ],
    },
    {
      key: "insights",
      label: t("nav.insights"),
      items: [
        { href: "/reports", label: t("nav.reports"), icon: BarChart2 },
      ],
    },
    {
      key: "system",
      label: t("nav.system"),
      items: [
        { href: "/settings", label: t("nav.settings"), icon: Settings2 },
      ],
    },
  ];

  return (
    <aside
      className="fixed top-0 h-full flex flex-col z-40"
      style={{
        width: 'var(--nav-width)',
        background: 'var(--glass-nav)',
        borderInlineEnd: '1px solid var(--border)',
        boxShadow: 'var(--shadow-nav)',
        [isRTL ? 'right' : 'left']: 0,
      }}
    >
      {/* Workspace header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
          style={{ background: 'var(--accent)' }}
        >
          O
        </div>
        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          OPENY OS
        </span>
      </div>

      <div className="mx-3 mb-1" style={{ height: '1px', background: 'var(--border)' }} />

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto py-2" style={{ scrollbarWidth: 'none' }}>
        {navSections.map((section) => (
          <div key={section.key} className="mb-1">
            <p className="nav-section-header">{section.label}</p>
            {section.items.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <motion.div
                  key={href}
                  whileHover={{ x: isRTL ? -2 : 2 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="px-2"
                >
                  <Link
                    href={href}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-100"
                    style={{
                      background: isActive ? 'var(--glass-nav-active)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    <Icon
                      size={16}
                      className="flex-shrink-0"
                      style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                    />
                    <span style={{ fontSize: 'var(--text-sm)' }}>{label}</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-2" style={{ height: '1px', background: 'var(--border)' }} />

      {/* Language switcher */}
      <div className="px-2 mb-2">
        <motion.button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors duration-100"
          style={{ color: 'var(--text-secondary)' }}
          whileHover={{ background: 'var(--glass-nav-active)' }}
          whileTap={{ scale: 0.98 }}
        >
          <Globe size={16} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <span style={{ fontSize: 'var(--text-sm)' }}>
            {language === "en" ? "العربية" : "English"}
          </span>
        </motion.button>
      </div>

      {/* User profile */}
      <div
        className="mx-3 mb-3 p-2.5 rounded-md flex items-center gap-2.5"
        style={{ background: 'var(--glass-overlay)', border: '1px solid var(--border)' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          A
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>Alex Chen</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }} className="truncate">Admin</p>
        </div>
      </div>
    </aside>
  );
}

