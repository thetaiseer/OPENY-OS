interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: string; positive: boolean };
}

const colorMap = {
  blue: {
    iconBg: 'linear-gradient(135deg, rgba(99,102,241,0.22) 0%, rgba(99,102,241,0.10) 100%)',
    iconColor: '#6366f1',
    glow: 'rgba(99,102,241,0.2)',
  },
  green: {
    iconBg: 'linear-gradient(135deg, rgba(16,185,129,0.22) 0%, rgba(16,185,129,0.10) 100%)',
    iconColor: '#10b981',
    glow: 'rgba(16,185,129,0.15)',
  },
  amber: {
    iconBg: 'linear-gradient(135deg, rgba(245,158,11,0.22) 0%, rgba(245,158,11,0.10) 100%)',
    iconColor: '#f59e0b',
    glow: 'rgba(245,158,11,0.14)',
  },
  red: {
    iconBg: 'linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0.10) 100%)',
    iconColor: '#ef4444',
    glow: 'rgba(239,68,68,0.14)',
  },
  violet: {
    iconBg: 'linear-gradient(135deg, rgba(168,85,247,0.22) 0%, rgba(168,85,247,0.10) 100%)',
    iconColor: 'var(--accent-3)',
    glow: 'rgba(168,85,247,0.14)',
  },
  mint: {
    iconBg: 'linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(56,189,248,0.10) 100%)',
    iconColor: 'var(--accent-2)',
    glow: 'rgba(56,189,248,0.14)',
  },
  rose: {
    iconBg: 'linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0.10) 100%)',
    iconColor: '#ef4444',
    glow: 'rgba(239,68,68,0.14)',
  },
  cyan: {
    iconBg: 'linear-gradient(135deg, rgba(56,189,248,0.22) 0%, rgba(56,189,248,0.10) 100%)',
    iconColor: '#38bdf8',
    glow: 'rgba(56,189,248,0.14)',
  },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="openy-motion-card relative overflow-hidden rounded-2xl border p-6"
      style={{
        background: 'var(--gradient-card-glass)',
        backdropFilter: 'var(--blur-glass)',
        WebkitBackdropFilter: 'var(--blur-glass)',
        borderColor: 'var(--border-glass)',
        boxShadow: 'var(--shadow-card), var(--highlight-inset)',
      }}
    >
      {/* Subtle background glow blob */}
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full"
        style={{
          background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
          filter: 'blur(12px)',
        }}
      />

      <div className="relative mb-4 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: c.iconBg,
            color: c.iconColor,
            boxShadow: `0 10px 20px ${c.glow}, 0 0 18px ${c.glow}`,
          }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{
              background: trend.positive ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: trend.positive ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>
      <div
        className="mb-1 text-3xl font-bold tracking-tight"
        style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
    </div>
  );
}
