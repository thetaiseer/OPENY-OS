"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users2, CheckSquare, FileText,
  ImageIcon, BarChart2, Settings2, UserCircle,
  ChevronLeft, ChevronRight, Globe,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const NAV_ITEMS = [
  { href: "/",          icon: LayoutDashboard, labelKey: "nav.dashboard",  section: "main" },
  { href: "/clients",   icon: Users2,           labelKey: "nav.clients",    section: "main" },
  { href: "/tasks",     icon: CheckSquare,      labelKey: "nav.tasks",      section: "main" },
  { href: "/content",   icon: FileText,         labelKey: "nav.content",    section: "main" },
  { href: "/team",      icon: UserCircle,       labelKey: "nav.team",       section: "resources" },
  { href: "/assets",    icon: ImageIcon,        labelKey: "nav.assets",     section: "resources" },
  { href: "/reports",   icon: BarChart2,        labelKey: "nav.reports",    section: "resources" },
  { href: "/approvals", icon: Sparkles,         labelKey: "nav.approvals",  section: "resources" },
  { href: "/settings",  icon: Settings2,        labelKey: "nav.settings",   section: "system" },
];

const SECTION_LABELS = {
  main:      { en: "Workspace",  ar: "مساحة العمل" },
  resources: { en: "Resources",  ar: "الموارد" },
  system:    { en: "System",     ar: "النظام" },
};

interface SideNavProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SideNav({ collapsed, onToggleCollapse }: SideNavProps) {
  const pathname = usePathname();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [tooltip, setTooltip] = useState<string | null>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current); }, []);

  const showTooltip = (label: string) => {
    if (collapsed) {
      tooltipTimeout.current = setTimeout(() => setTooltip(label), 300);
    }
  };
  const hideTooltip = () => {
    if (tooltipTimeout.current) clearTimeout(tooltipTimeout.current);
    setTooltip(null);
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const sections = Array.from(new Set(NAV_ITEMS.map(i => i.section)));

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      style={{
        width: collapsed ? 64 : 240,
        background: "var(--sidebar-bg)",
        borderRight: isRTL ? "none" : "1px solid var(--sidebar-border)",
        borderLeft: isRTL ? "1px solid var(--sidebar-border)" : "none",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: isRTL ? "auto" : 0,
        right: isRTL ? 0 : "auto",
        zIndex: 100,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{
        padding: collapsed ? "16px 0" : "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        borderBottom: "1px solid var(--border)",
        minHeight: 60,
        flexShrink: 0,
      }}>
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              key="logo-full"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "white",
                boxShadow: "0 0 16px rgba(59,130,246,0.35)",
                flexShrink: 0,
              }}>O</div>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                OPENY OS
              </span>
            </motion.div>
          )}
          {collapsed && (
            <motion.div
              key="logo-icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              style={{
                width: 30, height: 30, borderRadius: 8,
                background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: "white",
                boxShadow: "0 0 16px rgba(59,130,246,0.35)",
              }}>O</motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              width: 26, height: 26, borderRadius: 6,
              background: "var(--glass-overlay)",
              border: "1px solid var(--border)",
              cursor: "pointer", color: "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
            title={isRTL ? "توسيع" : "Collapse"}
          >
            {isRTL
              ? (collapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />)
              : (collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />)
            }
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 0" }}>
        {sections.map(section => {
          const items = NAV_ITEMS.filter(i => i.section === section);
          const sectionLabel = SECTION_LABELS[section as keyof typeof SECTION_LABELS];
          return (
            <div key={section} style={{ marginBottom: 4 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--text-muted)",
                  padding: "10px 20px 4px",
                }}>
                  {language === "ar" ? sectionLabel.ar : sectionLabel.en}
                </div>
              )}
              {items.map(item => {
                const active = isActive(item.href);
                const label = t(item.labelKey);
                return (
                  <div key={item.href} style={{ position: "relative" }}>
                    <Link
                      href={item.href}
                      onMouseEnter={() => showTooltip(label)}
                      onMouseLeave={hideTooltip}
                      style={{
                        display: "flex", alignItems: "center",
                        gap: 10, textDecoration: "none",
                        margin: "1px 8px",
                        padding: collapsed ? "10px 0" : "9px 12px",
                        borderRadius: 10,
                        justifyContent: collapsed ? "center" : "flex-start",
                        background: active ? "var(--glass-nav-active)" : "transparent",
                        border: active ? "1px solid var(--glass-nav-active-border)" : "1px solid transparent",
                        color: active ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: active ? 600 : 400,
                        fontSize: 13.5,
                        transition: "all 0.15s ease",
                        position: "relative",
                      }}
                    >
                      {active && (
                        <span style={{
                          position: "absolute",
                          left: isRTL ? "auto" : -8,
                          right: isRTL ? -8 : "auto",
                          top: "50%", transform: "translateY(-50%)",
                          width: 3, height: "60%",
                          background: "var(--accent)",
                          borderRadius: 2,
                          boxShadow: "0 0 8px var(--accent)",
                        }} />
                      )}
                      <item.icon
                        size={17}
                        style={{
                          flexShrink: 0,
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          filter: active ? "drop-shadow(0 0 4px rgba(59,130,246,0.5))" : "none",
                        }}
                      />
                      {!collapsed && (
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {label}
                        </span>
                      )}
                    </Link>

                    {/* Tooltip when collapsed */}
                    {collapsed && tooltip === label && (
                      <div style={{
                        position: "fixed",
                        left: isRTL ? "auto" : 72,
                        right: isRTL ? 72 : "auto",
                        background: "var(--panel-strong)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 8, padding: "5px 10px",
                        fontSize: 12, fontWeight: 500,
                        color: "var(--text)", whiteSpace: "nowrap",
                        boxShadow: "var(--shadow)",
                        zIndex: 9999,
                        pointerEvents: "none",
                        transform: "translateY(-50%)",
                        top: "50%",
                      }}>
                        {label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: collapsed ? "12px 0" : "12px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flexShrink: 0,
      }}>
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: collapsed ? "9px 0" : "9px 12px",
            borderRadius: 10, background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-secondary)",
            cursor: "pointer", fontSize: 13.5, fontWeight: 400,
            justifyContent: collapsed ? "center" : "flex-start",
            width: "100%",
            transition: "all 0.15s",
          }}
          title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Globe size={17} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          {!collapsed && <span>{language === "ar" ? "English" : "العربية"}</span>}
        </button>

        {/* Collapse toggle (collapsed state) */}
        {collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "9px 0",
              borderRadius: 10, background: "transparent",
              border: "1px solid transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              width: "100%",
              transition: "all 0.15s",
            }}
            title={isRTL ? "توسيع" : "Expand"}
          >
            {isRTL ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
          </button>
        )}
      </div>
    </motion.aside>
  );
}
