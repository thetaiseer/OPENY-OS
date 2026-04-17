interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: number; label?: string };
}

const colorMap = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6',  glow: 'rgba(59,130,246,0.25)'  },
  green:  { bg: 'rgba(16,185,129,0.12)',  text: '#10b981',  glow: 'rgba(16,185,129,0.25)'  },
  amber:  { bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b',  glow: 'rgba(245,158,11,0.25)'  },
  red:    { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444',  glow: 'rgba(239,68,68,0.25)'   },
  violet: { bg: 'rgba(139,92,246,0.12)',  text: '#8b5cf6',  glow: 'rgba(139,92,246,0.25)'  },
  mint:   { bg: 'rgba(5,150,105,0.12)',   text: '#059669',  glow: 'rgba(5,150,105,0.25)'   },
  rose:   { bg: 'rgba(244,63,94,0.12)',   text: '#f43f5e',  glow: 'rgba(244,63,94,0.25)'   },
  cyan:   { bg: 'rgba(6,182,212,0.12)',   text: '#06b6d4',  glow: 'rgba(6,182,212,0.25)'   },
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
