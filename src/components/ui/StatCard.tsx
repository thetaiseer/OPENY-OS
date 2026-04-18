interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: number; label?: string };
}

const colorMap = {
  blue:   { bg: 'rgba(47,139,255,0.16)', text: '#2f8bff', glow: 'rgba(47,139,255,0.36)' },
  green:  { bg: 'rgba(77,176,255,0.16)', text: '#4db0ff', glow: 'rgba(77,176,255,0.34)' },
  amber:  { bg: 'rgba(245,158,11,0.14)', text: '#f59e0b', glow: 'rgba(245,158,11,0.26)' },
  red:    { bg: 'rgba(239,68,68,0.14)',  text: '#ef4444', glow: 'rgba(239,68,68,0.26)' },
  violet: { bg: 'rgba(88,154,255,0.16)', text: '#589aff', glow: 'rgba(88,154,255,0.34)' },
  mint:   { bg: 'rgba(57,146,255,0.16)', text: '#3992ff', glow: 'rgba(57,146,255,0.34)' },
  rose:   { bg: 'rgba(255,95,125,0.14)', text: '#ff5f7d', glow: 'rgba(255,95,125,0.24)' },
  cyan:   { bg: 'rgba(124,196,255,0.16)', text: '#7cc4ff', glow: 'rgba(124,196,255,0.34)' },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  const up = trend ? trend.value >= 0 : null;
  return (
    <div
      className="glass glass-card group relative overflow-hidden rounded-2xl p-5"
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-16 h-24 blur-3xl opacity-65 transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: `radial-gradient(circle, ${c.glow} 0%, transparent 72%)` }}
      />
      <div className="flex items-start justify-between mb-4">
        <div
          className="relative z-[1] w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `linear-gradient(165deg, ${c.bg}, color-mix(in srgb, ${c.bg} 70%, transparent))`,
            color: c.text,
            boxShadow: `0 0 0 1px ${c.glow}, 0 8px 20px color-mix(in srgb, ${c.glow} 58%, transparent)`,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: up ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
              color: up ? '#10b981' : '#ef4444',
            }}
          >
            {up ? '▲' : '▼'} {Math.abs(trend.value)}%{trend.label ? ` ${trend.label}` : ''}
          </span>
        )}
      </div>
      <div
        className="relative z-[1] text-3xl font-extrabold mb-0.5 tracking-tight tabular-nums"
        style={{ color: 'var(--text)' }}
      >
        {value}
      </div>
      <div className="glass-card__label relative z-[1]" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
