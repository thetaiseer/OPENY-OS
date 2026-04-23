interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: string; positive: boolean };
}

const colorMap = {
  blue: {
    iconBg: 'linear-gradient(135deg, rgba(58,95,224,0.18) 0%, rgba(58,95,224,0.10) 100%)',
    iconColor: 'var(--accent)',
    glow: 'rgba(58,95,224,0.15)',
  },
  green: {
    iconBg: 'linear-gradient(135deg, rgba(10,144,96,0.18) 0%, rgba(10,144,96,0.10) 100%)',
    iconColor: '#0a9060',
    glow: 'rgba(10,144,96,0.12)',
  },
  amber: {
    iconBg: 'linear-gradient(135deg, rgba(196,126,10,0.18) 0%, rgba(196,126,10,0.10) 100%)',
    iconColor: '#c47e0a',
    glow: 'rgba(196,126,10,0.12)',
  },
  red: {
    iconBg: 'linear-gradient(135deg, rgba(192,52,74,0.18) 0%, rgba(192,52,74,0.10) 100%)',
    iconColor: '#c0344a',
    glow: 'rgba(192,52,74,0.12)',
  },
  violet: {
    iconBg: 'linear-gradient(135deg, rgba(139,109,255,0.18) 0%, rgba(139,109,255,0.10) 100%)',
    iconColor: 'var(--accent-3)',
    glow: 'rgba(139,109,255,0.12)',
  },
  mint: {
    iconBg: 'linear-gradient(135deg, rgba(6,182,200,0.18) 0%, rgba(6,182,200,0.10) 100%)',
    iconColor: 'var(--accent-2)',
    glow: 'rgba(6,182,200,0.12)',
  },
  rose: {
    iconBg: 'linear-gradient(135deg, rgba(225,29,72,0.18) 0%, rgba(225,29,72,0.10) 100%)',
    iconColor: '#be123c',
    glow: 'rgba(225,29,72,0.12)',
  },
  cyan: {
    iconBg: 'linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0.10) 100%)',
    iconColor: '#0891b2',
    glow: 'rgba(6,182,212,0.12)',
  },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="openy-motion-card relative overflow-hidden rounded-3xl border p-6"
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
