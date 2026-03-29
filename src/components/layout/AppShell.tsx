"use client";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { PageTransition } from "./PageTransition";
import { useLanguage } from "@/lib/LanguageContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isRTL } = useLanguage();

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-0)' }}>
      {/* Desktop side nav */}
      <div className="hidden lg:block">
        <SideNav />
      </div>
      
      {/* Mobile top bar */}
      <div className="lg:hidden">
        <TopBar />
      </div>
      
      {/* Main content — shifts right (LTR) or left (RTL) to clear the nav */}
      <main
        className="min-h-screen"
        style={{ [isRTL ? 'paddingRight' : 'paddingLeft']: 'var(--lg-nav-offset, 0px)' }}
      >
        {/* Tailwind responsive nav offset */}
        <style>{`@media (min-width: 1024px) { :root { --lg-nav-offset: 240px; } }`}</style>
        <div className="lg:hidden" style={{ height: 'var(--topbar-height)' }} />
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

