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
        <div className="lg:hidden h-14" />
        <div className="pb-20 lg:pb-8 px-4 lg:px-8 pt-6 lg:pt-8 max-w-[1400px] mx-auto">
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

