"use client";
import { usePathname } from "next/navigation";
import { Bell, Zap, Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function TopBar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();

  const pageTitles: Record<string, string> = {
    "/": t("nav.dashboard"),
    "/projects": t("nav.projects"),
    "/clients": t("nav.clients"),
    "/team": t("nav.team"),
    "/tasks": t("nav.tasks"),
    "/settings": t("nav.settings"),
  };

  const title = pageTitles[pathname] || "OPENY OS";
  
  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-40"
      style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
          <Zap size={14} color="white" fill="white" />
        </div>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Language switcher */}
        <button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          title={language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
        >
          <Globe size={13} />
          <span>{language === "en" ? "ع" : "EN"}</span>
        </button>
        <button
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
        >
          <Bell size={16} />
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
          A
        </div>
      </div>
    </header>
  );
}

