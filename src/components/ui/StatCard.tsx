interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
}

const colorMap = {
  blue:   { bg: 'color-mix(in srgb, var(--accent) 10%, white)', text: 'var(--accent)' },
  green:  { bg: 'rgba(16,185,129,0.12)', text: '#059669' },
  amber:  { bg: 'rgba(245,158,11,0.13)', text: '#d97706' },
  red:    { bg: 'rgba(239,68,68,0.12)', text: '#dc2626' },
  violet: { bg: 'rgba(124,58,237,0.12)', text: '#7c3aed' },
  mint:   { bg: 'rgba(20,184,166,0.12)', text: '#0f766e' },
  rose:   { bg: 'rgba(225,29,72,0.12)', text: '#be123c' },
  cyan:   { bg: 'rgba(6,182,212,0.12)', text: '#0891b2' },
};

export default function StatCard({ label, value, icon, color = 'blue' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="rounded-2xl p-6 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: c.bg, color: c.text }}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold mb-1 tracking-tight" style={{ color: 'var(--text)' }}>{value}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
