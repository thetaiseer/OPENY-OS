"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Search, X, ChevronRight } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useTheme } from "@/components/layout/ThemeProvider";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

export function TopBar() {
  const pathname = usePathname();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { theme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  // Close search on route change
  useEffect(() => { setSearchOpen(false); }, [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  const pageTitles: Record<string, string> = {
    "/": t("nav.dashboard"),
    "/clients": t("nav.clients"),
    "/content": t("nav.content"),
    "/tasks": t("nav.tasks"),
    "/team": t("nav.team"),
    "/approvals": t("nav.approvals"),
    "/assets": t("nav.assets"),
    "/reports": t("nav.reports"),
    "/settings": t("nav.settings"),
  };

  const title = pageTitles[pathname] ?? "";

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 z-40"
        style={{
          height: "var(--topbar-height)",
          background: "var(--glass-topbar)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderBottom: "1px solid var(--border)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        {/* Left: logo badge + breadcrumb */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)",
              boxShadow: "0 4px 12px rgba(79,142,247,0.30)",
            }}
          >
            <img
              src={theme === "light" ? "/assets/logo-light.png" : "/assets/logo-dark.png"}
              alt="OPENY OS"
              style={{ height: 20, width: "auto", objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
          </div>

          {title && (
            <div className="flex items-center gap-1.5 min-w-0" dir={isRTL ? "rtl" : "ltr"}>
              <span
                className="text-xs font-medium flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                OPENY
              </span>
              <ChevronRight
                size={12}
                style={{ color: "var(--text-muted)", flexShrink: 0, transform: isRTL ? "scaleX(-1)" : "none" }}
              />
              <span
                className="text-sm font-semibold truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {title}
              </span>
            </div>
          )}
        </div>

        {/* Center: spacer */}
        <div className="flex-1" />

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {/* Search button */}
          <motion.button
            onClick={() => setSearchOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
            style={{ color: "var(--text-secondary)" }}
            whileHover={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
            whileTap={{ scale: 0.92 }}
            title="Search"
            aria-label="Search"
          >
            <Search size={16} />
          </motion.button>

          {/* Language toggle */}
          <motion.button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={{
              background: "var(--glass-overlay)",
              color: "var(--text-secondary)",
              border: "1px solid var(--glass-overlay-border)",
            }}
            whileHover={{ background: "var(--surface-3)" }}
            whileTap={{ scale: 0.95 }}
            title={language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
          >
            <Globe size={12} />
            <span>{language === "en" ? "ع" : "EN"}</span>
          </motion.button>

          {/* Notifications */}
          <NotificationCenter />

          {/* User avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-secondary) 100%)",
              boxShadow: "0 2px 8px rgba(79,142,247,0.30)",
            }}
          >
            A
          </div>
        </div>
      </header>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
            style={{ background: "var(--modal-overlay-bg)", backdropFilter: "blur(8px)" }}
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 440, damping: 32 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-strong)",
                boxShadow: "var(--shadow-lg)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search input row */}
              <div className="flex items-center gap-3 px-4 py-4">
                <Search size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search pages, tasks, clients…"
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                  aria-label="Search"
                />
                <motion.button
                  onClick={() => setSearchOpen(false)}
                  className="rounded-lg p-1.5"
                  style={{ color: "var(--text-muted)" }}
                  whileHover={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
                  whileTap={{ scale: 0.93 }}
                >
                  <X size={14} />
                </motion.button>
              </div>

              {/* Footer hint */}
              <div
                className="flex items-center justify-between px-4 py-2.5"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface-1)" }}
              >
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Press{" "}
                  <kbd
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                    style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
                  >
                    Esc
                  </kbd>{" "}
                  to close
                </span>
                <span className="text-[10px] font-medium" style={{ color: "var(--text-muted)" }}>
                  ⌘K
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


