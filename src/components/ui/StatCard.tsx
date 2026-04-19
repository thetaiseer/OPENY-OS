import { StatCard as PremiumStatCard } from '@/components/ui/system/Primitives';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: number; label?: string };
}

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

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const tone = toneMap[color];
  const up = trend ? trend.value >= 0 : null;

  return (
    <PremiumStatCard
      title={label}
      value={value}
      icon={<span style={{ color: tone.icon }}>{icon}</span>}
      action={trend ? (
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
    />
  );
}
