"use client";
import { usePathname } from "next/navigation";
import { Menu, Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { NotificationCenter } from "@/components/ui/NotificationCenter";

export function TopBar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();

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
    <header
      className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 z-40"
      style={{
        height: 'var(--topbar-height)',
        background: 'var(--glass-topbar)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left: menu icon + breadcrumb title */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
        {title && (
          <span
            className="font-semibold"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
          >
            {title}
          </span>
        )}
      </div>

      {/* Right: language switcher + notifications + avatar */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="flex items-center gap-1 px-2 py-1 rounded-md transition-colors"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            background: 'var(--glass-overlay)',
            border: '1px solid var(--border)',
          }}
          title={language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
        >
          <Globe size={12} />
          <span>{language === "en" ? "ع" : "EN"}</span>
        </button>
        <NotificationCenter />
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
          style={{ background: 'var(--accent)' }}
        >
          A
        </div>
      </div>
    </header>
  );
}

