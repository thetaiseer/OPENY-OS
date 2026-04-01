"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { Search, Menu, LogOut, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAuth } from "@/lib/AuthContext";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { useRouter } from "next/navigation";

interface TopBarProps {
  sidebarWidth: number;
  onMobileMenuOpen?: () => void;
}

export function TopBar({ sidebarWidth, onMobileMenuOpen }: TopBarProps) {
  const { language, isRTL } = useLanguage();
  const { user, member, signOut } = useAuth();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    return language === "ar"
      ? hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور"
      : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  }, [language]);

  // Derive display name and initials
  const displayName = member?.name ?? user?.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    router.replace("/login");
  };

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

        {/* User menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button
            onClick={() => setUserMenuOpen(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--glass-overlay)",
              border: "1px solid var(--border)",
              borderRadius: 12, padding: "4px 10px 4px 4px",
              cursor: "pointer", color: "var(--text)",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "white",
              flexShrink: 0,
            }}>
              {initials}
            </div>
            <span className="hidden md:block" style={{ fontSize: 13, fontWeight: 500, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </span>
            <ChevronDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: isRTL ? "auto" : 0,
              left: isRTL ? 0 : "auto",
              background: "var(--panel)",
              border: "1px solid var(--border)",
              borderRadius: 14,
              boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
              minWidth: 180,
              overflow: "hidden",
              zIndex: 200,
            }}>
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: 0 }}>{displayName}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>{user?.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "11px 16px",
                  background: "none", border: "none",
                  cursor: "pointer", color: "#f87171",
                  fontSize: 13, fontWeight: 500,
                  textAlign: isRTL ? "right" : "left",
                  direction: isRTL ? "rtl" : "ltr",
                }}
              >
                <LogOut size={15} />
                {language === "ar" ? "تسجيل الخروج" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


