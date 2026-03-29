"use client";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { useTheme } from "@/components/layout/ThemeProvider";

export function TopBar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { theme } = useTheme();

  const pageTitles: Record<string, string> = {
    "/": t("nav.dashboard"),
    "/clients": t("nav.clients"),
    "/content": t("nav.content"),
    "/tasks": t("nav.tasks"),
    "/team": t("nav.team"),
    "/approvals": t("nav.approvals"),
    "/assets": t("nav.assets"),
    "/reports": t("nav.reports"),
    "/publishing": t("nav.publishing"),
    "/settings": t("nav.settings"),
  };

  const title = pageTitles[pathname];
  
  return (
    <header
      className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-4 z-40"
      style={{ background: 'var(--glass-topbar)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2.5">
        <img
          src={theme === "light" ? "/assets/logo-light.png" : "/assets/logo-dark.png"}
          alt="OPENY OS"
          height={30}
          style={{ height: 30, width: "auto", objectFit: "contain" }}
        />
        {title && (
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {/* Language switcher */}
        <button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: 'var(--glass-overlay)', color: 'var(--text-secondary)', border: '1px solid var(--glass-overlay-border)' }}
          title={language === "en" ? "Switch to Arabic" : "التبديل إلى الإنجليزية"}
        >
          <Globe size={13} />
          <span>{language === "en" ? "ع" : "EN"}</span>
        </button>
        {/* Notification bell */}
        <NotificationCenter />
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
          A
        </div>
      </div>
    </header>
  );
}

