import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

type TrendDirection = 'up' | 'down' | 'flat';

interface StatCardProps {
  label: string;
  value: string | number;
  /** Optional trend indicator */
  trend?: {
    direction: TrendDirection;
    label: string;
  };
  /** Optional icon rendered in the top-right */
  icon?: ReactNode;
  /** Optional extra CSS class to extend grid column span */
  className?: string;
}

const TREND_ICONS: Record<TrendDirection, ReactNode> = {
  up:   <TrendingUp  size={12} />,
  down: <TrendingDown size={12} />,
  flat: <Minus       size={12} />,
const toneMap = {
  blue:   { bg: 'var(--color-info-bg)',    icon: 'var(--color-info)'    },
  green:  { bg: 'var(--color-success-bg)', icon: 'var(--color-success)' },
  amber:  { bg: 'var(--color-warning-bg)', icon: 'var(--color-warning)' },
  red:    { bg: 'var(--color-danger-bg)',  icon: 'var(--color-danger)'  },
  violet: { bg: 'var(--accent-soft)',      icon: 'var(--accent)'        },
  mint:   { bg: 'var(--color-success-bg)', icon: 'var(--color-success)' },
  rose:   { bg: 'var(--color-danger-bg)',  icon: 'var(--color-danger)'  },
  cyan:   { bg: 'var(--color-info-bg)',    icon: 'var(--color-info)'    },
};

const TREND_CLASS: Record<TrendDirection, string> = {
  up:   'ui-stat-trend-up',
  down: 'ui-stat-trend-down',
  flat: 'ui-stat-trend-flat',
};

/**
 * StatCard — displays a single metric with an optional trend indicator.
 * Occupies 3 columns in a 12-col grid by default (.ui-stat-card).
 */
export function StatCard({ label, value, trend, icon, className }: StatCardProps) {
  return (
    <div className={`ui-card ui-stat-card${className ? ' ' + className : ''}`}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div className="ui-stat-label">{label}</div>
        {icon && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--brand-soft)',
              border: '1px solid var(--border-brand)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--brand)',
            }}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="ui-stat-value">{value}</div>

      {trend && (
        <div className={`ui-stat-trend ${TREND_CLASS[trend.direction]}`}>
          {TREND_ICONS[trend.direction]}
          <span>{trend.label}</span>
        </div>
      )}
    </div>
    <article
      className="relative overflow-hidden rounded-xl border bg-[var(--surface)] p-5"
      style={{ borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ background: tone.bg, color: tone.icon }}
        >
          {icon}
        </div>

        {trend ? (
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: up ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: up ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {up ? '▲' : '▼'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
          </span>
        ) : null}
      </div>

      <p className="text-2xl font-800 tracking-tight" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </p>
    </article>
  );
}
