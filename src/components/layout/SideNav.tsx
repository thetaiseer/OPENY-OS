"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users2, UserCircle, CheckSquare, Settings2, Globe, CalendarDays, ClipboardCheck, ImageIcon, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users2, UserCircle, CheckSquare,
  Settings2, Globe, FileText, ClipboardCheck,
  ImageIcon, BarChart2, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ElementType;
}

interface NavSection {
  id: string;
  labelKey: string | null;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    labelKey: null,
    items: [
      { href: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "manage",
    labelKey: "nav.section.manage",
    items: [
      { href: "/clients",   labelKey: "nav.clients",   icon: Users2 },
      { href: "/content",   labelKey: "nav.content",   icon: FileText },
      { href: "/tasks",     labelKey: "nav.tasks",     icon: CheckSquare },
      { href: "/approvals", labelKey: "nav.approvals", icon: ClipboardCheck },
    ],
  },
  {
    id: "resources",
    labelKey: "nav.section.resources",
    items: [
      { href: "/team",    labelKey: "nav.team",    icon: UserCircle },
      { href: "/assets",  labelKey: "nav.assets",  icon: ImageIcon },
      { href: "/reports", labelKey: "nav.reports", icon: BarChart2 },
    ],
  },
  {
    id: "settings",
    labelKey: "nav.section.settings",
    items: [
      { href: "/settings", labelKey: "nav.settings", icon: Settings2 },
    ],
  },
];

interface TooltipState {
  label: string;
  top: number;
}

interface SideNavProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SideNav({ collapsed, onToggleCollapse }: SideNavProps) {
  const pathname = usePathname();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { theme } = useTheme();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    };
  }, []);

  const handleMouseEnterItem = (label: string, e: React.MouseEvent<HTMLElement>) => {
    if (!collapsed) return;
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2 - 12 });
  };

  const handleMouseLeaveItem = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    tooltipTimeout.current = setTimeout(() => setTooltip(null), 80);
  };

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
  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <>
      <motion.aside
        animate={{ width: sidebarWidth }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="fixed top-0 h-full flex flex-col z-40 overflow-hidden"
        style={{
          background: "var(--glass-nav)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderInlineEnd: "1px solid var(--border)",
          boxShadow: "var(--shadow-nav)",
          [isRTL ? "right" : "left"]: 0,
        }}
      >
        {/* Workspace header */}
        <div
          className="flex items-center justify-between px-3 pt-4 pb-3 flex-shrink-0"
          style={{ minHeight: 60 }}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div
              className="flex-shrink-0 rounded-lg flex items-center justify-center"
              style={{
                width: 34,
                height: 34,
                background: "var(--accent-dim)",
                border: "1px solid var(--glass-nav-active-border)",
              }}
            >
              <img
                src={theme === "light" ? "/assets/logo-light.png" : "/assets/logo-dark.png"}
                alt="OPENY OS"
                style={{ height: 22, width: "auto", objectFit: "contain" }}
              />
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>
                    OPENY Workspace
                  </p>
                  <p className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                    Marketing Agency
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            onClick={onToggleCollapse}
            className="flex-shrink-0 rounded-lg p-1.5 transition-colors"
            style={{ color: "var(--text-muted)" }}
            whileHover={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
            whileTap={{ scale: 0.92 }}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen size={15} />
              : <PanelLeftClose size={15} />}
          </motion.button>
        </div>

        <div className="mx-3 mb-2 flex-shrink-0" style={{ height: 1, background: "var(--border)" }} />

        {/* Nav sections */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-1">
          {NAV_SECTIONS.map((section) => (
            <div key={section.id}>
              <AnimatePresence initial={false}>
                {!collapsed && section.labelKey && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.14 }}
                    className="sidebar-nav-section-label"
                  >
                    {t(section.labelKey)}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="space-y-0.5">
                {section.items.map(({ href, labelKey, icon: Icon }) => {
                  const label = t(labelKey);
                  const isActive =
                    pathname === href || (href !== "/" && pathname.startsWith(href));

                  return (
                    <motion.div
                      key={href}
                      whileHover={{ x: collapsed ? 0 : isRTL ? -2 : 2 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      onMouseEnter={(e) => handleMouseEnterItem(label, e)}
                      onMouseLeave={handleMouseLeaveItem}
                    >
                      <Link
                        href={href}
                        className="relative flex items-center rounded-lg transition-colors duration-150"
                        style={{
                          gap: collapsed ? 0 : 10,
                          padding: collapsed ? "9px 0" : "8px 10px",
                          justifyContent: collapsed ? "center" : "flex-start",
                          background: isActive ? "var(--glass-nav-active)" : "transparent",
                          color: isActive ? "var(--accent)" : "var(--text-secondary)",
                          boxShadow: isActive
                            ? "inset 0 0 0 1px var(--glass-nav-active-border)"
                            : "none",
                        }}
                      >
                        {/* Left border indicator for active item */}
                        {isActive && !collapsed && (
                          <motion.span
                            layoutId="nav-active-bar"
                            className="absolute rounded-full"
                            style={{
                              [isRTL ? "right" : "left"]: -8,
                              top: "50%",
                              transform: "translateY(-50%)",
                              width: 3,
                              height: 18,
                              background: "var(--accent)",
                              borderRadius: 99,
                            }}
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}

                        <Icon size={17} className="flex-shrink-0" />

                        <AnimatePresence initial={false}>
                          {!collapsed && (
                            <motion.span
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: "auto" }}
                              exit={{ opacity: 0, width: 0 }}
                              transition={{ duration: 0.15 }}
                              className="text-sm font-medium whitespace-nowrap overflow-hidden"
                            >
                              {label}
                            </motion.span>
                          )}
                        </AnimatePresence>

                        {isActive && !collapsed && (
                          <motion.div
                            className="ms-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: "var(--accent)" }}
                            layoutId="nav-dot"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="flex-shrink-0 px-2 pb-3 space-y-1.5">
          <div className="flex-shrink-0" style={{ height: 1, background: "var(--border)", marginBottom: 6 }} />

          {/* Language switcher */}
          <motion.button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="w-full flex items-center rounded-lg transition-colors"
            style={{
              gap: collapsed ? 0 : 10,
              padding: collapsed ? "9px 0" : "8px 10px",
              justifyContent: collapsed ? "center" : "flex-start",
              background: "var(--glass-overlay)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-overlay-border)",
            }}
            whileHover={{ background: "var(--surface-3)" }}
            whileTap={{ scale: 0.97 }}
            onMouseEnter={(e) =>
              handleMouseEnterItem(language === "en" ? "العربية" : "English", e)
            }
            onMouseLeave={handleMouseLeaveItem}
            title={language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
          >
            <Globe size={15} className="flex-shrink-0" />
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs font-semibold whitespace-nowrap overflow-hidden"
                >
                  {language === "en" ? "العربية" : "English"}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* User card */}
          <div
            className="flex items-center rounded-lg overflow-hidden"
            style={{
              gap: collapsed ? 0 : 10,
              padding: collapsed ? "9px 0" : "9px 10px",
              justifyContent: collapsed ? "center" : "flex-start",
              background: "var(--glass-overlay)",
              border: "1px solid var(--glass-overlay-border)",
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: "var(--accent)" }}
            >
              A
            </div>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden whitespace-nowrap min-w-0"
                >
                  <p className="text-xs font-semibold leading-tight truncate" style={{ color: "var(--text-primary)" }}>
                    Alex Chen
                  </p>
                  <p className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                    Admin
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      {/* Tooltip for collapsed mode */}
      <AnimatePresence>
        {collapsed && tooltip && (
          <motion.div
            key={tooltip.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            className="sidebar-tooltip"
            style={{
              top: tooltip.top,
              [isRTL ? "right" : "left"]: 80,
            }}
          >
            {tooltip.label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

