'use client';

import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useLang } from '@/lib/lang-context';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('settings')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage your preferences</p>
      </div>

      <div className="rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Profile</h2>
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
            style={{ background: 'var(--accent)' }}
          >
            {user ? (user.name || user.email).charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <p className="font-medium" style={{ color: 'var(--text)' }}>{user?.name}</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user?.email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border p-6 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Theme</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Currently: {theme}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Switch to {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Language</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Currently: {lang === 'en' ? 'English' : 'Arabic'}
            </p>
          </div>
          <button
            onClick={toggleLang}
            className="h-9 px-4 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            Switch to {lang === 'en' ? 'Arabic' : 'English'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border p-6 space-y-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Backend</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          PocketBase URL:{' '}
          <code className="text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
            {process.env.NEXT_PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090'}
          </code>
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Set NEXT_PUBLIC_POCKETBASE_URL environment variable to configure
        </p>
      </div>

      <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Account</h2>
        <button
          onClick={logout}
          className="h-9 px-4 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
        >
          {t('logout')}
        </button>
      </div>
    </div>
  );
}
