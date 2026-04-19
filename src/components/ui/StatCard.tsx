import { StatCard as PremiumStatCard } from '@/components/ui/system/Primitives';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'neutral';
  trend?: { value: number; label?: string };
}

const toneMap = {
  blue: { color: 'var(--accent)' },
  neutral: { color: 'var(--text-secondary)' },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const tone = toneMap[color];
  const up = trend ? trend.value >= 0 : null;

  return (
    <PremiumStatCard
      title={label}
      value={value}
      icon={<span style={{ color: tone.color }}>{icon}</span>}
      action={trend ? (
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            background: up ? 'var(--accent-soft)' : 'var(--surface-2)',
            color: up ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {up ? '▲' : '▼'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
        </span>
      ) : null}
    />
  );
}
