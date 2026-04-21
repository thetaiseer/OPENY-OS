interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
  trend?: { value: string; positive: boolean };
}

const colorMap = {
  blue:   { iconBg: 'linear-gradient(135deg, rgba(58,95,224,0.18) 0%, rgba(58,95,224,0.10) 100%)', iconColor: 'var(--accent)', glow: 'rgba(58,95,224,0.15)' },
  green:  { iconBg: 'linear-gradient(135deg, rgba(10,144,96,0.18) 0%, rgba(10,144,96,0.10) 100%)', iconColor: '#0a9060', glow: 'rgba(10,144,96,0.12)' },
  amber:  { iconBg: 'linear-gradient(135deg, rgba(196,126,10,0.18) 0%, rgba(196,126,10,0.10) 100%)', iconColor: '#c47e0a', glow: 'rgba(196,126,10,0.12)' },
  red:    { iconBg: 'linear-gradient(135deg, rgba(192,52,74,0.18) 0%, rgba(192,52,74,0.10) 100%)', iconColor: '#c0344a', glow: 'rgba(192,52,74,0.12)' },
  violet: { iconBg: 'linear-gradient(135deg, rgba(139,109,255,0.18) 0%, rgba(139,109,255,0.10) 100%)', iconColor: 'var(--accent-3)', glow: 'rgba(139,109,255,0.12)' },
  mint:   { iconBg: 'linear-gradient(135deg, rgba(6,182,200,0.18) 0%, rgba(6,182,200,0.10) 100%)', iconColor: 'var(--accent-2)', glow: 'rgba(6,182,200,0.12)' },
  rose:   { iconBg: 'linear-gradient(135deg, rgba(225,29,72,0.18) 0%, rgba(225,29,72,0.10) 100%)', iconColor: '#be123c', glow: 'rgba(225,29,72,0.12)' },
  cyan:   { iconBg: 'linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0.10) 100%)', iconColor: '#0891b2', glow: 'rgba(6,182,212,0.12)' },
};

export default function StatCard({ label, value, icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="rounded-3xl p-6 border relative overflow-hidden"
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
        className="absolute -top-4 -right-4 w-24 h-24 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
          filter: 'blur(12px)',
        }}
      />

      <div className="relative flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
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
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
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
        className="text-3xl font-bold mb-1 tracking-tight"
        style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
