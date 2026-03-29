"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Search, X } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { useTheme } from "@/components/layout/ThemeProvider";

export function TopBar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

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
        className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-40"
        style={{
          background: "var(--glass-topbar)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left: logo + title */}
        <div className="flex items-center gap-3">
          <div
            className="rounded-lg flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              background: "var(--accent-dim)",
              border: "1px solid var(--glass-nav-active-border)",
            }}
          >
            <img
              src={theme === "light" ? "/assets/logo-light.png" : "/assets/logo-dark.png"}
              alt="OPENY OS"
              style={{ height: 20, width: "auto", objectFit: "contain" }}
            />
          </div>
          {title && (
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {title}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {/* Search button */}
          <motion.button
            onClick={() => setSearchOpen(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
            style={{ color: "var(--text-secondary)" }}
            whileHover={{ background: "var(--surface-3)", color: "var(--text-primary)" }}
            whileTap={{ scale: 0.93 }}
            title="Search"
          >
            <Search size={16} />
          </motion.button>

          {/* Language toggle */}
          <motion.button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors"
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "var(--accent)" }}
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
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-md)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
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
                  className="rounded-lg p-1"
                  style={{ color: "var(--text-muted)" }}
                  whileHover={{ background: "var(--surface-3)" }}
                >
                  <X size={14} />
                </motion.button>
              </div>
              <div
                className="px-4 py-3 text-xs"
                style={{ color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}
              >
                Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>Esc</kbd> to close
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

