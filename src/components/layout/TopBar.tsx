"use client";
import Link from "next/link";
import { Search, Sun, Moon, Bell, UserCircle, Menu } from "lucide-react";
import { useTheme } from "@/components/layout/ThemeProvider";
import { useLanguage } from "@/lib/LanguageContext";
import { useNotifications } from "@/lib/NotificationContext";

interface TopBarProps {
  sidebarWidth: number;
  onMobileMenuOpen?: () => void;
}

const iconBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: "transparent",
  border: "1px solid transparent",
  color: "var(--text-secondary)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.15s",
  position: "relative",
  flexShrink: 0,
};

export function TopBar({ sidebarWidth, onMobileMenuOpen }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const { isRTL } = useLanguage();
  const { unreadCount } = useNotifications();

  const onEnter = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "var(--surface-2)";
    e.currentTarget.style.borderColor = "var(--border)";
    e.currentTarget.style.color = "var(--text)";
  };
  const onLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.background = "transparent";
    e.currentTarget.style.borderColor = "transparent";
    e.currentTarget.style.color = "var(--text-secondary)";
  };

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: isRTL ? 0 : sidebarWidth,
        right: isRTL ? sidebarWidth : 0,
        height: "var(--topbar-height)",
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--header-border)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 99,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
        transition: "left 0.2s ease, right 0.2s ease",
      }}
    >
      {/* Mobile menu button */}
      <button
        className="md:hidden"
        onClick={onMobileMenuOpen}
        style={iconBtnStyle}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        title="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 400, position: "relative" }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: isRTL ? "auto" : 10,
            right: isRTL ? 10 : "auto",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Search..."
          readOnly
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            height: 36,
            paddingLeft: isRTL ? 56 : 32,
            paddingRight: isRTL ? 32 : 56,
            fontSize: 13,
            width: "100%",
            color: "var(--text)",
            outline: "none",
            cursor: "default",
            fontFamily: "inherit",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: isRTL ? "auto" : 8,
            left: isRTL ? 8 : "auto",
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 11,
            color: "var(--text-muted)",
            padding: "1px 5px",
            pointerEvents: "none",
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Right actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          style={iconBtnStyle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Notifications */}
        <Link
          href="/notifications"
          style={{ ...iconBtnStyle, display: "inline-flex" }}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title="Notifications"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: 7,
                right: 7,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--danger)",
                border: "1.5px solid var(--header-bg)",
              }}
            />
          )}
        </Link>

        {/* Profile */}
        <button
          style={iconBtnStyle}
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          title="Profile"
        >
          <UserCircle size={20} style={{ color: "var(--accent)" }} />
        </button>
      </div>
    </header>
  );
}
