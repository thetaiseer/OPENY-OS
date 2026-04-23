'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, KeyRound } from 'lucide-react';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProfile = pathname.startsWith('/settings/profile') || pathname === '/settings';
  const isPassword = pathname.startsWith('/settings/password');

  const tabs = [
    { href: '/settings/profile', label: 'Profile & Preferences', icon: Settings },
    { href: '/settings/password', label: 'Change Password', icon: KeyRound },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Manage your account and preferences
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/settings/profile' ? isProfile : isPassword;
          return (
            <Link
              key={href}
              href={href}
              className="-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                borderColor: active ? 'var(--accent)' : 'transparent',
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
