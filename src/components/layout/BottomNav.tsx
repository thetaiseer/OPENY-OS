"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, Users2, CheckSquare, Settings2 } from "lucide-react";

const items = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/team", label: "Team", icon: Users2 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function BottomNav() {
  const pathname = usePathname();
  
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 flex items-center justify-around px-2 z-40"
      style={{
        background: 'var(--surface-1)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[56px]"
            style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
