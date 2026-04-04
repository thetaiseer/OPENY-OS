interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'mint' | 'rose' | 'cyan';
}

const colorMap = {
  blue:   { bg: '#eff6ff', text: '#2563eb' },
  green:  { bg: '#f0fdf4', text: '#16a34a' },
  amber:  { bg: '#fffbeb', text: '#d97706' },
  red:    { bg: '#fef2f2', text: '#dc2626' },
  violet: { bg: '#f5f3ff', text: '#7c3aed' },
  mint:   { bg: '#f0fdf4', text: '#059669' },
  rose:   { bg: '#fff1f2', text: '#e11d48' },
  cyan:   { bg: '#ecfeff', text: '#0891b2' },
};

export default function StatCard({ label, value, icon, color = 'blue' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      className="rounded-2xl p-6 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: c.bg, color: c.text }}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold mb-1" style={{ color: 'var(--text)' }}>{value}</div>
      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</div>
    </div>
  );
}
