'use client';

import Link from 'next/link';
import { Languages, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from '@/context/theme-context';
import { useLang } from '@/context/lang-context';
import { useAppPeriod } from '@/context/app-period-context';
import { cn } from '@/lib/cn';
import OpenyLogo from '@/components/branding/OpenyLogo';
import { openyAppChromeLogoDimensions } from '@/lib/openy-brand';
import UserAccountMenu from '@/components/layout/UserAccountMenu';
import NotificationDropdown from '@/components/features/notifications/NotificationDropdown';
import PeriodDateRangePicker from '@/components/ui/date-range/PeriodDateRangePicker';

type TopbarProps = {
  className?: string;
};

export default function Topbar({ className }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { t, lang, toggleLang } = useLang();
  const { periodFrom, periodTo, setPeriodRange } = useAppPeriod();

  return (
    <header
      className={cn(
        'openy-glass fixed end-0 start-0 top-0 z-30 border-b pt-[env(safe-area-inset-top,0px)] md:end-0 md:start-[var(--openy-sidebar-width)]',
        className,
      )}
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between gap-2 pe-[max(0.75rem,env(safe-area-inset-right,0px))] ps-[max(0.75rem,env(safe-area-inset-left,0px))] sm:gap-3 sm:pe-4 sm:ps-4 md:pe-6 md:ps-6">
        <Link
          href="/dashboard"
          className="me-1 flex min-w-0 shrink-0 items-center md:hidden"
          aria-label={t('dashboard')}
        >
          <OpenyLogo
            {...openyAppChromeLogoDimensions(34)}
            className="max-w-[min(100vw-12rem,200px)]"
          />
        </Link>
        <label className="relative flex min-w-0 max-w-md flex-1 items-center">
          <Search className="pointer-events-none absolute start-3 h-4 w-4 text-secondary" />
          <input
            type="search"
            placeholder={t('search')}
            className="focus:ring-[color:var(--accent)]/15 min-h-10 w-full rounded-control border border-border bg-surface py-2 pe-3 ps-9 text-sm text-primary outline-none transition-colors placeholder:text-secondary focus:border-accent focus:ring-2 sm:h-10 sm:py-0"
          />
        </label>
        <PeriodDateRangePicker
          from={periodFrom}
          to={periodTo}
          onChange={setPeriodRange}
          label={t('appPeriodMonth')}
          className="shrink-0"
        />
        <div className="ms-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-control border border-border bg-surface px-3 py-2 text-secondary transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-primary sm:h-11 sm:min-w-[4.5rem]"
            aria-label={lang === 'ar' ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
            onClick={toggleLang}
            title={lang === 'ar' ? 'Switch to English' : 'اللغة العربية'}
          >
            <Languages className="h-4 w-4" />
            <span className="text-[11px] font-semibold leading-none">
              {lang === 'ar' ? 'EN' : 'AR'}
            </span>
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control border border-border bg-surface text-secondary transition-colors hover:bg-[color:var(--surface-elevated)] hover:text-primary sm:h-11 sm:w-11"
            aria-label={theme === 'light' ? t('switchToDark') : t('switchToLight')}
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
            title={theme === 'light' ? t('switchToDark') : t('switchToLight')}
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>
          <NotificationDropdown />
          <UserAccountMenu />
        </div>
      </div>
    </header>
  );
}
