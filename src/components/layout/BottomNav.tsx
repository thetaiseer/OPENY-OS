"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users2, CheckSquare, FileText, Settings2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

const BOTTOM_NAV_ITEMS = [
  { href: "/",         icon: LayoutDashboard, labelEn: "Home",     labelAr: "الرئيسية" },
  { href: "/clients",  icon: Users2,           labelEn: "Clients",  labelAr: "العملاء" },
  { href: "/tasks",    icon: CheckSquare,      labelEn: "Tasks",    labelAr: "المهام" },
  { href: "/content",  icon: FileText,         labelEn: "Content",  labelAr: "المحتوى" },
  { href: "/settings", icon: Settings2,        labelEn: "Settings", labelAr: "الإعدادات" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { language } = useLanguage();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      height: "var(--bottomnav-height)",
      background: "var(--sidebar-bg, rgba(5,8,16,0.97))",
      borderTop: "1px solid var(--border)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      zIndex: 90,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {BOTTOM_NAV_ITEMS.map(item => {
        const active = isActive(item.href);
        const label = language === "ar" ? item.labelAr : item.labelEn;
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: "8px 18px",
              borderRadius: 14,
              textDecoration: "none",
              color: active ? "var(--accent)" : "var(--text-muted)",
              transition: "all 0.15s",
              minWidth: 60,
              background: active ? "var(--glass-nav-active)" : "transparent",
              position: "relative",
            }}
          >
            <item.icon
              size={21}
              style={{
                filter: active ? "drop-shadow(0 0 6px rgba(59,130,246,0.7))" : "none",
              }}
            />
            <span style={{
              fontSize: 10.5, fontWeight: active ? 600 : 400,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}>
              {label}
            </span>
            {active && (
              <span style={{
                position: "absolute",
                bottom: 4,
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--accent)",
                boxShadow: "0 0 8px var(--accent)",
              }} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
