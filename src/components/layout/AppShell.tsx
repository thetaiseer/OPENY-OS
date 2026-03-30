"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => pathname === item.href || (item.match ? pathname.startsWith(item.match) : pathname.startsWith(item.href) && item.href !== "/")) ?? NAV_ITEMS[0],
    [pathname]
  );

  const shellPadding = collapsed ? "lg:px-5" : "lg:px-7";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="pointer-events-none fixed inset-0 opacity-90">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_left,rgba(106,168,255,0.24),transparent_38%),radial-gradient(circle_at_top_right,rgba(169,139,255,0.24),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
        <div className="absolute bottom-0 left-1/2 h-[340px] w-[340px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(61,217,180,0.14),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={`hidden border-e border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-6 backdrop-blur-2xl lg:flex ${collapsed ? "w-[104px]" : "w-[284px]"}`}
          style={{ borderInlineEnd: "1px solid var(--border)" }}
        >
          <DesktopSidebar
            pathname={pathname}
            activeItem={activeItem}
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            onNavigate={() => setMobileOpen(false)}
          />
        </aside>

        {/* Mobile drawer overlay */}
        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-[rgba(7,10,20,0.76)] backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <motion.aside
                initial={{ x: isRTL ? 120 : -120, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: isRTL ? 120 : -120, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${isRTL ? "right-0" : "left-0"} top-0 h-full w-[86vw] max-w-[320px] border-e border-[var(--border)] bg-[var(--sidebar-bg)] px-4 py-6 backdrop-blur-3xl`}
              >
                <DesktopSidebar
                  pathname={pathname}
                  activeItem={activeItem}
                  collapsed={false}
                  setCollapsed={() => undefined}
                  onNavigate={() => setMobileOpen(false)}
                  mobile
                />
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Top header — compact on mobile */}
          <header className={`sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-2xl ${shellPadding} px-4 py-3 sm:px-6 sm:py-4`}>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="touch-target inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] text-[var(--text)] lg:hidden"
                aria-label={language === "ar" ? "فتح القائمة" : "Open navigation"}
              >
                <Menu size={18} />
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold tracking-[-0.03em] text-[var(--text)] sm:text-lg">
                  {language === "ar" ? activeItem.title.ar : activeItem.title.en}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusPill icon={Languages} label={language === "ar" ? "AR" : "EN"} onClick={() => setLanguage(language === "ar" ? "en" : "ar")} />
                <StatusPill icon={theme === "dark" ? SunMedium : MoonStar} label={theme === "dark" ? (language === "ar" ? "فاتح" : "Light") : (language === "ar" ? "داكن" : "Dark")} onClick={toggleTheme} />
                <Link
                  href="/settings"
                  className="inline-flex touch-target items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-2 text-sm text-[var(--text)]"
                  aria-label={language === "ar" ? "الإشعارات" : "Notifications"}
                >
                  <Activity size={16} className="text-[var(--mint)]" />
                  <span>{unreadCount}</span>
                </Link>
              </div>
            </div>
          </header>

          {/* Page content */}
          <main className={`${shellPadding} relative flex-1 overflow-y-auto px-4 py-5 mobile-page-content sm:px-6 sm:py-8`}>
            <AnimatePresence mode="wait">
              <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <BottomNav />
    </div>
  );
}

function DesktopSidebar({
  pathname,
  activeItem,
  collapsed,
  setCollapsed,
  onNavigate,
  mobile = false,
}: {
  pathname: string;
  activeItem: NavItem;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onNavigate: () => void;
  mobile?: boolean;
}) {
  const { language, isRTL } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className="flex min-h-full w-full flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* OPENY Logo */}
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden"
          >
            <img
              src="/assets/openy-logo.png"
              alt="OPENY OS"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-bold text-[var(--text)]">OPENY OS</div>
              <div className="text-xs text-[var(--muted)]">
                {language === "ar" ? "مساحة العمل" : "Workspace"}
              </div>
            </div>
          )}
        </div>
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] text-[var(--text)] lg:hidden"
            aria-label={language === "ar" ? "إغلاق القائمة" : "Close navigation"}
          >
            <X size={18} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] text-[var(--text)] lg:inline-flex"
            aria-label={language === "ar" ? "طي/توسيع الشريط الجانبي" : "Toggle sidebar"}
          >
            {isRTL ? (collapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />) : collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || (item.match ? pathname.startsWith(item.match) : item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="group relative overflow-hidden rounded-2xl border px-3 py-3 transition duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                background: active ? "linear-gradient(135deg, rgba(106,168,255,0.16), rgba(169,139,255,0.16))" : "var(--glass-overlay)",
              }}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] text-[var(--text)]">
                  <Icon size={18} className={active ? "text-[var(--accent)]" : "text-[var(--muted)]"} />
                </span>
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--text)]">
                      {language === "ar" ? item.title.ar : item.title.en}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function StatusPill({ icon: Icon, label, onClick }: { icon: typeof Languages; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-2 text-sm text-[var(--text)] transition duration-200 hover:opacity-80"
    >
      <Icon size={16} className="text-[var(--accent)]" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

