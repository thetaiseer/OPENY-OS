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
      className="rounded-2xl p-5 border transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
        boxShadow: 'var(--shadow-sm)',
        backdropFilter: 'blur(var(--blur-md))',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: c.bg,
            color: c.text,
            boxShadow: `0 0 0 1px ${c.glow}`,
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
        className="text-3xl font-extrabold mb-0.5 tracking-tight"
        style={{ color: 'var(--text)' }}
      >
        {value}
      </div>
      <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
