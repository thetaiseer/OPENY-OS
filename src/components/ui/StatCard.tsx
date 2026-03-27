import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  positive?: boolean;
  accent?: boolean;
}

export function StatCard({ label, value, icon: Icon, change, positive = true, accent }: StatCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: accent ? 'var(--accent-dim)' : 'var(--surface-2)',
        border: `1px solid ${accent ? 'rgba(79,142,247,0.3)' : 'var(--border)'}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accent ? 'var(--accent)' : 'var(--surface-3)' }}
        >
          <Icon size={18} color={accent ? 'white' : 'var(--text-secondary)'} />
        </div>
        {change && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{
              background: positive ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
              color: positive ? 'var(--success)' : 'var(--error)',
            }}
          >
            {change}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
          {value}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </div>
  );
}
