interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: number; label?: string };
}

const toneMap = {
  blue: { bg: 'rgba(47,139,255,0.14)', glow: 'rgba(47,139,255,0.45)' },
  green: { bg: 'rgba(18,191,118,0.14)', glow: 'rgba(18,191,118,0.45)' },
  amber: { bg: 'rgba(255,176,32,0.14)', glow: 'rgba(255,176,32,0.45)' },
  red: { bg: 'rgba(255,91,114,0.14)', glow: 'rgba(255,91,114,0.45)' },
  violet: { bg: 'rgba(106,115,255,0.14)', glow: 'rgba(106,115,255,0.45)' },
  mint: { bg: 'rgba(57,226,199,0.14)', glow: 'rgba(57,226,199,0.45)' },
  rose: { bg: 'rgba(255,120,179,0.14)', glow: 'rgba(255,120,179,0.45)' },
  cyan: { bg: 'rgba(65,179,255,0.14)', glow: 'rgba(65,179,255,0.45)' },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const tone = toneMap[color];
  const up = trend ? trend.value >= 0 : null;

  return (
    <article className="openy-card glass glass-card card relative overflow-hidden rounded-2xl border p-5">
      <div className="pointer-events-none absolute -top-16 left-0 right-0 h-24 blur-3xl" style={{ background: `radial-gradient(circle, ${tone.glow} 0%, transparent 70%)` }} />

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
