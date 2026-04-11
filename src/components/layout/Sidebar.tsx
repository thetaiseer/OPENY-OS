'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users2, CheckSquare, FolderOpen,
  BarChart2, Users, Settings, X, CalendarDays, UserCheck, Shield, FileText,
} from 'lucide-react';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import AccountMenu from './AccountMenu';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/my-tasks',  icon: UserCheck,       key: 'myTasks'   },
  { href: '/clients',   icon: Users2,          key: 'clients'   },
  { href: '/tasks',     icon: CheckSquare,     key: 'tasks'     },
  { href: '/content',   icon: FileText,        key: 'content'   },
  { href: '/calendar',  icon: CalendarDays,    key: 'calendar'  },
  { href: '/assets',    icon: FolderOpen,      key: 'assets'    },
  { href: '/reports',   icon: BarChart2,       key: 'reports'   },
  { href: '/team',      icon: Users,           key: 'team'      },
  { href: '/security',  icon: Shield,          key: 'security'  },
  { href: '/settings',  icon: Settings,        key: 'settings'  },
];

interface SidebarProps { open?: boolean; onClose?: () => void; }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLang();
  const { user } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-60 z-40 flex flex-col',
          'border-r transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        {/* Logo */}
        <div
          className="flex items-center justify-between h-16 px-5 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            OPENY <span style={{ color: 'var(--accent)' }}>OS</span>
          </span>
          {onClose && (
            <button onClick={onClose} className="lg:hidden p-1 rounded hover:opacity-70">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, key }) => {
            const active =
              pathname === href ||
              (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'text-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]',
                )}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span>{t(key)}</span>
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <AccountMenu placement="sidebar">
            <div className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-[var(--surface-2)] transition-colors cursor-pointer">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                style={{ background: 'var(--accent)' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {user.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {user.role}
                </p>
              </div>
            </div>
          </AccountMenu>
        </div>
      </aside>
    </>
  );
}
