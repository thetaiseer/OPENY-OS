"use client";
import { useState } from "react";
import { Search, Menu } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

interface TopBarProps {
  sidebarWidth: number;
  onMobileMenuOpen?: () => void;
}

export function TopBar({ sidebarWidth, onMobileMenuOpen }: TopBarProps) {
  const { language, isRTL } = useLanguage();
  const [searchFocused, setSearchFocused] = useState(false);

  const now = new Date();
  const hour = now.getHours();
  const greeting =
    language === "ar"
      ? hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور"
      : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: isRTL ? 0 : sidebarWidth,
        right: isRTL ? sidebarWidth : 0,
        height: "var(--topbar-height)",
        background: "var(--glass-topbar)",
        borderBottom: "1px solid var(--header-border)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 24px",
        zIndex: 90,
        transition: "left 0.25s ease, right 0.25s ease",
      }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuOpen}
        className="md:hidden"
        style={{
          width: 36, height: 36, borderRadius: 8,
          background: "var(--glass-overlay)",
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
        }}
      >
        <Menu size={18} />
      </button>

      {/* Greeting */}
      <div className="hidden md:block" style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1 }}>{greeting}</p>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginTop: 2, lineHeight: 1 }}>
          OPENY OS
        </p>
      </div>

      {/* Search bar */}
      <div style={{
        position: "relative",
        flex: "0 1 360px",
        display: "flex",
        alignItems: "center",
      }}>
        <Search
          size={15}
          style={{
            position: "absolute",
            left: isRTL ? "auto" : 11,
            right: isRTL ? 11 : "auto",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder={language === "ar" ? "بحث سريع..." : "Quick search..."}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          style={{
            width: "100%",
            height: 36,
            background: searchFocused ? "rgba(255,255,255,0.07)" : "var(--glass-input)",
            border: `1px solid ${searchFocused ? "var(--border-focus)" : "var(--border-strong)"}`,
            borderRadius: 10,
            color: "var(--text)",
            fontSize: 13,
            paddingLeft: isRTL ? 10 : 32,
            paddingRight: isRTL ? 32 : 10,
            outline: "none",
            transition: "all 0.15s",
            boxShadow: searchFocused ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {/* Notifications */}
        <NotificationCenter />

        {/* Avatar */}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "white",
          cursor: "pointer",
          boxShadow: "0 0 12px rgba(59,130,246,0.3)",
        }}>
          A
        </div>
      </div>
    </header>
  );
}
