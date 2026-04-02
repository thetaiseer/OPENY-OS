"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users2,
  CheckSquare,
  FolderOpen,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Globe,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, labelEn: "Dashboard", labelAr: "الرئيسية" },
  { href: "/clients",   icon: Users2,          labelEn: "Clients",   labelAr: "العملاء" },
  { href: "/tasks",     icon: CheckSquare,     labelEn: "Tasks",     labelAr: "المهام" },
  { href: "/assets",    icon: FolderOpen,      labelEn: "Assets",    labelAr: "الملفات" },
  { href: "/settings",  icon: Settings2,       labelEn: "Settings",  labelAr: "الإعدادات" },
];

interface SideNavProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function SideNav({ collapsed, onToggleCollapse }: SideNavProps) {
  const pathname = usePathname();
  const { language, setLanguage, isRTL } = useLanguage();
  const isAr = language === "ar";

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <aside
      style={{
        width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)",
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
        transition: "width 0.2s ease",
        overflow: "hidden",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: "60px",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: "var(--accent)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 700,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          O
        </div>
        {!collapsed && (
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: "var(--text)",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            OPENY OS
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav
        style={{
          flex: 1,
          padding: "12px 8px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 10,
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                transition: "all 0.15s",
                background: active ? "var(--nav-active-bg)" : "transparent",
                color: active ? "var(--nav-active-text)" : "var(--text-secondary)",
                textDecoration: "none",
                border: active ? "1px solid var(--nav-active-border)" : "1px solid transparent",
              }}
            >
              <item.icon size={17} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ whiteSpace: "nowrap" }}>
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          padding: "12px 8px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {/* Language toggle */}
        <button
          onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            width: "100%",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 400,
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          title={language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
        >
          <Globe size={16} style={{ flexShrink: 0 }} />
          {!collapsed && (
            <span>{isAr ? "English" : "العربية"}</span>
          )}
        </button>

        {/* Collapse toggle */}
        <button
          onClick={onToggleCollapse}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            width: "100%",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 13,
            fontWeight: 400,
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid transparent",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isRTL
            ? (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
            : (collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />)
          }
          {!collapsed && (
            <span>{isAr ? "طي" : "Collapse"}</span>
          )}
        </button>
      </div>
    </aside>
  );
}
