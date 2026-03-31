"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  FolderKanban,
  Globe,
  House,
  Image,
  Languages,
  LayoutDashboard,
  Menu,
  MoonStar,
  ShieldCheck,
  SunMedium,
  Users,
  Workflow,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLanguage } from "@/lib/LanguageContext";
import { useNotifications } from "@/lib/NotificationContext";
import { useTheme } from "./ThemeProvider";
import { BottomNav } from "./BottomNav";

type NavItem = {
  href: string;
  title: { en: string; ar: string };
  icon: typeof House;
  match?: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", title: { en: "Dashboard", ar: "لوحة التحكم" }, icon: LayoutDashboard },
  { href: "/content", title: { en: "Content", ar: "المحتوى" }, icon: FolderKanban },
  { href: "/tasks", title: { en: "Tasks", ar: "المهام" }, icon: Workflow },
  { href: "/clients", title: { en: "Clients", ar: "العملاء" }, icon: BriefcaseBusiness, match: "/clients" },
  { href: "/approvals", title: { en: "Approvals", ar: "الموافقات" }, icon: ShieldCheck },
  { href: "/publishing", title: { en: "Publishing", ar: "النشر" }, icon: Globe },
  { href: "/reports", title: { en: "Analytics", ar: "التحليلات" }, icon: BarChart3 },
  { href: "/team", title: { en: "Team", ar: "الفريق" }, icon: Users },
  { href: "/assets", title: { en: "Assets", ar: "الأصول" }, icon: Image },
  { href: "/settings", title: { en: "Settings", ar: "الإعدادات" }, icon: Activity },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { language, setLanguage, isRTL } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = useMemo(
    () =>
      NAV_ITEMS.find(
        (item) =>
          pathname === item.href ||
          (item.match ? pathname.startsWith(item.match) : item.href !== "/" && pathname.startsWith(item.href))
      ) ?? NAV_ITEMS[0],
    [pathname]
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {/* ── Top Navigation Bar ── */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "var(--header-bg)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-xs)",
          height: "var(--topbar-height)",
        }}
      >
        <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex flex-shrink-0 items-center gap-2.5 me-2">
            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl">
              <img
                src="/assets/openy-logo.png"
                alt="OPENY"
                className="h-full w-full object-contain"
                style={{ filter: "var(--logo-filter)" }}
              />
            </div>
            <span className="hidden text-base font-bold tracking-[-0.03em] sm:block" style={{ color: "var(--text)" }}>
              OPENY
            </span>
          </Link>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex lg:items-center lg:gap-1">
            {NAV_ITEMS.slice(0, 7).map((item) => {
              const active =
                pathname === item.href ||
                (item.match ? pathname.startsWith(item.match) : item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150"
                  style={{
                    color: active ? "var(--accent)" : "var(--muted)",
                    background: active ? "var(--glass-nav-active)" : "transparent",
                  }}
                >
                  <Icon size={15} />
                  <span>{language === "ar" ? item.title.ar : item.title.en}</span>
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              type="button"
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="touch-target hidden items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-150 sm:flex"
              style={{
                borderColor: "var(--border)",
                background: "var(--glass-overlay)",
                color: "var(--muted)",
              }}
              aria-label={language === "ar" ? "Switch to English" : "التبديل للعربية"}
            >
              <Languages size={14} style={{ color: "var(--accent)" }} />
              {language === "ar" ? "EN" : "AR"}
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="touch-target flex items-center justify-center rounded-xl border transition-all duration-150"
              style={{
                borderColor: "var(--border)",
                background: "var(--glass-overlay)",
                color: "var(--muted)",
                width: 40,
                height: 40,
              }}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <SunMedium size={16} /> : <MoonStar size={16} />}
            </button>

            {/* Notifications */}
            <Link
              href="/settings"
              className="touch-target relative flex items-center justify-center rounded-xl border transition-all duration-150"
              style={{
                borderColor: "var(--border)",
                background: "var(--glass-overlay)",
                color: "var(--muted)",
                width: 40,
                height: 40,
              }}
              aria-label={language === "ar" ? "الإشعارات" : "Notifications"}
            >
              <Activity size={16} style={{ color: "var(--mint)" }} />
              {unreadCount > 0 && (
                <span
                  className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: "var(--rose)" }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>

            {/* Mobile menu button */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="touch-target flex items-center justify-center rounded-xl border lg:hidden"
              style={{
                borderColor: "var(--border)",
                background: "var(--glass-overlay)",
                color: "var(--text)",
                width: 40,
                height: 40,
              }}
              aria-label={language === "ar" ? "فتح القائمة" : "Open navigation"}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 lg:hidden"
            style={{ background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(4px)" }}
            onClick={() => setMobileOpen(false)}
          >
            <motion.aside
              initial={{ x: isRTL ? "100%" : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? "100%" : "-100%" }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              onClick={(e) => e.stopPropagation()}
              className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 h-full w-[84vw] max-w-[320px] border-e overflow-y-auto`}
              style={{
                background: "var(--panel)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {/* Drawer header */}
              <div
                className="flex items-center justify-between border-b px-5 py-4"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl">
                    <img
                      src="/assets/openy-logo.png"
                      alt="OPENY"
                      className="h-full w-full object-contain"
                      style={{ filter: "var(--logo-filter)" }}
                    />
                  </div>
                  <span className="text-sm font-bold" style={{ color: "var(--text)" }}>
                    OPENY OS
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{ borderColor: "var(--border)", background: "var(--glass-overlay)", color: "var(--muted)" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Current page label */}
              <div className="px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {language === "ar" ? activeItem.title.ar : activeItem.title.en}
                </p>
              </div>

              {/* Nav items */}
              <nav className="px-3 pb-6">
                {NAV_ITEMS.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.match
                      ? pathname.startsWith(item.match)
                      : item.href !== "/" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-150 mb-1"
                      style={{
                        color: active ? "var(--accent)" : "var(--text)",
                        background: active ? "var(--glass-nav-active)" : "transparent",
                        borderLeft: active && !isRTL ? "3px solid var(--accent)" : "3px solid transparent",
                        borderRight: active && isRTL ? "3px solid var(--accent)" : "3px solid transparent",
                      }}
                    >
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{
                          background: active ? "var(--accent-soft)" : "var(--glass-overlay)",
                          color: active ? "var(--accent)" : "var(--muted)",
                        }}
                      >
                        <Icon size={16} />
                      </span>
                      <span>{language === "ar" ? item.title.ar : item.title.en}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Drawer footer */}
              <div
                className="border-t px-5 py-4 flex items-center gap-2"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  type="button"
                  onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                  className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold flex-1 justify-center"
                  style={{ borderColor: "var(--border)", background: "var(--glass-overlay)", color: "var(--muted)" }}
                >
                  <Languages size={13} style={{ color: "var(--accent)" }} />
                  {language === "ar" ? "English" : "العربية"}
                </button>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{ borderColor: "var(--border)", background: "var(--glass-overlay)", color: "var(--muted)" }}
                >
                  {theme === "dark" ? <SunMedium size={15} /> : <MoonStar size={15} />}
                </button>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Content ── */}
      <main className="mx-auto max-w-screen-2xl px-4 py-6 mobile-page-content sm:px-6 sm:py-8 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}

