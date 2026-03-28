"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Users2, UserCircle, CheckSquare, Settings2, Zap, Globe } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

export function SideNav() {
  const pathname = usePathname();
  const { t, language, setLanguage, isRTL } = useLanguage();

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/projects", label: t("nav.projects"), icon: FolderKanban },
    { href: "/clients", label: t("nav.clients"), icon: Users2 },
    { href: "/team", label: t("nav.team"), icon: UserCircle },
    { href: "/tasks", label: t("nav.tasks"), icon: CheckSquare },
    { href: "/settings", label: t("nav.settings"), icon: Settings2 },
  ];

  return (
    <aside
      className="fixed top-0 h-full w-[220px] flex flex-col z-40"
      style={{
        background: 'var(--surface-1)',
        borderInlineEnd: '1px solid var(--border)',
        [isRTL ? 'right' : 'left']: 0,
      }}
    >
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--accent)' }}>
            <Zap size={16} color="white" fill="white" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>OPENY OS</p>
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>v1.0</p>
          </div>
        </div>
      </div>
      
      <div className="mx-4 mb-4" style={{ height: '1px', background: 'var(--border)' }} />
      
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
              style={{
                background: isActive ? 'var(--accent-dim)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={17} className="flex-shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Language switcher */}
      <div className="px-3 mb-3">
        <button
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <Globe size={17} className="flex-shrink-0" />
          <span className="text-sm font-medium">
            {language === "en" ? "العربية" : "English"}
          </span>
        </button>
      </div>
      
      <div
        className="mx-3 mb-4 p-3 rounded-xl flex items-center gap-2.5"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0" style={{ background: 'var(--accent)' }}>
          A
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>Alex Chen</p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>Admin</p>
        </div>
      </div>
    </aside>
  );
}

