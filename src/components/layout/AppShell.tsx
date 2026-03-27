"use client";
import { SideNav } from "./SideNav";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: React.ReactNode }) {
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
      
      {/* Main content */}
      <main className="lg:pl-[220px] min-h-screen">
        <div className="lg:hidden h-14" />
        <div className="pb-20 lg:pb-8 px-4 lg:px-8 pt-6 lg:pt-8 max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
      
      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
