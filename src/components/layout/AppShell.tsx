"use client";
import { useEffect, useState } from "react";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { PageTransition } from "./PageTransition";
import { useLanguage } from "@/lib/LanguageContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isRTL } = useLanguage();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sidebarWidth = sidebarCollapsed ? 72 : 240;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      document.documentElement.style.setProperty(
        "--lg-nav-offset",
        mq.matches ? `${sidebarWidth}px` : "0px"
      );
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [sidebarWidth]);

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-0)" }}>
      {/* Desktop side nav */}
      <div className="hidden lg:block">
        <SideNav
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden">
        <TopBar />
      </div>

      {/* Main content — shifts to clear the nav */}
      <main
        className="min-h-screen transition-[padding] duration-300 ease-in-out"
        style={{
          [isRTL ? "paddingRight" : "paddingLeft"]: `var(--lg-nav-offset, 0px)`,
        }}
      >
        <style>{`@media (min-width: 1024px) { :root { --lg-nav-offset: 240px; } }`}</style>
        {/* Mobile topbar spacer */}
        <div className="lg:hidden" style={{ height: "var(--topbar-height)" }} />
        <div className="pb-24 lg:pb-10 px-4 lg:px-7 pt-6 lg:pt-7 max-w-[1440px] mx-auto">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}


