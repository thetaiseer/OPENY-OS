"use client";
import { usePathname } from "next/navigation";
import { Bell, Zap } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/projects": "Projects",
  "/clients": "Clients",
  "/team": "Team",
  "/tasks": "Tasks",
  "/settings": "Settings",
};

export function TopBar() {
  const pathname = usePathname();
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
        <button className="w-9 h-9 rounded-xl flex items-center justify-center transition-all" style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}>
          <Bell size={16} />
        </button>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: 'var(--accent)' }}>
          A
        </div>
      </div>
    </header>
  );
}
