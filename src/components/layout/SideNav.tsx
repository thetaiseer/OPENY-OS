"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users2, CheckSquare, FileText,
  ImageIcon, BarChart2, Settings2, UserCircle,
  ChevronLeft, ChevronRight, Globe,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const NAV_ITEMS = [
  { href: "/clients",   icon: Users2,           labelKey: "nav.clients",    section: "main" },
  { href: "/tasks",     icon: CheckSquare,      labelKey: "nav.tasks",      section: "global" },
  { href: "/content",   icon: FileText,         labelKey: "nav.content",    section: "global" },
  { href: "/team",      icon: UserCircle,       labelKey: "nav.team",       section: "global" },
  { href: "/assets",    icon: ImageIcon,        labelKey: "nav.assets",     section: "global" },
  { href: "/reports",   icon: BarChart2,        labelKey: "nav.reports",    section: "global" },
  { href: "/settings",  icon: Settings2,        labelKey: "nav.settings",   section: "system" },
];

const SECTION_LABELS = {
  main:   { en: "Clients",       ar: "العملاء"       },
  global: { en: "Global Views",  ar: "عرض عام"       },
  system: { en: "System",        ar: "النظام"        },
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

  const isActive = (href: string) => pathname.startsWith(href);

  const sections = Array.from(new Set(NAV_ITEMS.map(i => i.section)));

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 260 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      style={{
        width: collapsed ? 68 : 260,
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
        padding: collapsed ? "18px 0" : "18px 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "space-between",
        borderBottom: "1px solid var(--border)",
        minHeight: 70,
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
              style={{ display: "flex", alignItems: "center", gap: 12 }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 800, color: "white",
                boxShadow: "0 0 20px rgba(59,130,246,0.4)",
                flexShrink: 0,
              }}>O</div>
              <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
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
                width: 36, height: 36, borderRadius: 10,
                background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 800, color: "white",
                boxShadow: "0 0 20px rgba(59,130,246,0.4)",
              }}>O</motion.div>
          )}
        </AnimatePresence>

        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: "var(--glass-overlay)",
              border: "1px solid var(--border)",
              cursor: "pointer", color: "var(--text-muted)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s",
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
      <nav style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "10px 0" }}>
        {sections.map(section => {
          const items = NAV_ITEMS.filter(i => i.section === section);
          const sectionLabel = SECTION_LABELS[section as keyof typeof SECTION_LABELS];
          return (
            <div key={section} style={{ marginBottom: 6 }}>
              {!collapsed && (
                <div style={{
                  fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "var(--text-muted)",
                  padding: "14px 24px 6px",
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
                        gap: 11, textDecoration: "none",
                        margin: "2px 10px",
                        padding: collapsed ? "11px 0" : "11px 14px",
                        borderRadius: 12,
                        justifyContent: collapsed ? "center" : "flex-start",
                        background: active ? "var(--glass-nav-active)" : "transparent",
                        border: active ? "1px solid var(--glass-nav-active-border)" : "1px solid transparent",
                        color: active ? "var(--accent)" : "var(--text-secondary)",
                        fontWeight: active ? 600 : 400,
                        fontSize: 14,
                        transition: "all 0.15s ease",
                        position: "relative",
                      }}
                    >
                      {active && (
                        <span style={{
                          position: "absolute",
                          left: isRTL ? "auto" : -10,
                          right: isRTL ? -10 : "auto",
                          top: "50%", transform: "translateY(-50%)",
                          width: 3, height: "50%",
                          background: "var(--accent)",
                          borderRadius: 2,
                          boxShadow: "0 0 10px var(--accent)",
                        }} />
                      )}
                      <item.icon
                        size={17}
                        style={{
                          flexShrink: 0,
                          color: active ? "var(--accent)" : "var(--text-muted)",
                          filter: active ? "drop-shadow(0 0 5px rgba(59,130,246,0.6))" : "none",
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
                        left: isRTL ? "auto" : 76,
                        right: isRTL ? 76 : "auto",
                        background: "var(--panel-strong)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 8, padding: "6px 12px",
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
        padding: collapsed ? "14px 0" : "14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flexShrink: 0,
      }}>
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          style={{
            display: "flex", alignItems: "center", gap: 11,
            padding: collapsed ? "11px 0" : "11px 14px",
            borderRadius: 12, background: "transparent",
            border: "1px solid transparent",
            color: "var(--text-secondary)",
            cursor: "pointer", fontSize: 14, fontWeight: 400,
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
              padding: "11px 0",
              borderRadius: 12, background: "transparent",
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
