interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: number; label?: string };
}

const toneMap = {
  blue: { bg: 'var(--accent-soft)' },
  green: { bg: 'var(--color-success-bg)' },
  amber: { bg: 'var(--color-warning-bg)' },
  red: { bg: 'var(--color-danger-bg)' },
  violet: { bg: 'var(--accent-soft)' },
  mint: { bg: 'var(--color-success-bg)' },
  rose: { bg: 'var(--color-danger-bg)' },
  cyan: { bg: 'var(--color-info-bg)' },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const tone = toneMap[color];
  const up = trend ? trend.value >= 0 : null;

  return (
    <article className="openy-card card relative overflow-hidden rounded-2xl border p-5">
      <div className="relative z-10 mb-4 flex items-start justify-between gap-3">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: tone.bg, color: 'var(--accent)' }}>
          {icon}
        </div>

        {trend ? (
          <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: up ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: up ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {up ? '▲' : '▼'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
          </span>
        ) : null}
      </div>

      <p className="relative z-10 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="relative z-10 mt-1 text-sm text-[var(--text-secondary)]">{label}</p>
    </article>
  );
}
