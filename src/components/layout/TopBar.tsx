"use client";
import { useMemo, useState } from "react";
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

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return language === "ar"
      ? hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور"
      : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, [language]);

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
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 28px",
        zIndex: 90,
        transition: "left 0.25s ease, right 0.25s ease",
      }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMobileMenuOpen}
        className="md:hidden"
        style={{
          width: 38, height: 38, borderRadius: 10,
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
        <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1, letterSpacing: "0.01em" }}>{greeting}</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginTop: 3, lineHeight: 1, letterSpacing: "-0.01em" }}>
          OPENY OS
        </p>
      </div>

      {/* Search bar */}
      <div style={{
        position: "relative",
        flex: "0 1 400px",
        display: "flex",
        alignItems: "center",
      }}>
        <Search
          size={15}
          style={{
            position: "absolute",
            left: isRTL ? "auto" : 13,
            right: isRTL ? 13 : "auto",
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
            height: 40,
            background: searchFocused ? "rgba(255,255,255,0.07)" : "var(--glass-input)",
            border: `1px solid ${searchFocused ? "var(--border-focus)" : "var(--border-strong)"}`,
            borderRadius: 12,
            color: "var(--text)",
            fontSize: 13,
            paddingLeft: isRTL ? 12 : 36,
            paddingRight: isRTL ? 36 : 12,
            outline: "none",
            transition: "all 0.15s",
            boxShadow: searchFocused ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
          }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* Notifications */}
        <NotificationCenter />

        {/* Avatar */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "white",
          cursor: "pointer",
          boxShadow: "0 0 16px rgba(59,130,246,0.35)",
          flexShrink: 0,
        }}>
          A
        </div>
      </div>
    </header>
  );
}
