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
  up:   <TrendingUp   size={12} />,
  down: <TrendingDown size={12} />,
  flat: <Minus        size={12} />,
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
  );
}

