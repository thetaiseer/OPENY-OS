import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}

export function SectionHeader({ title, subtitle, action, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          {Icon && <Icon size={20} style={{ color: 'var(--accent)' }} />}
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h1>
        </div>
        {subtitle && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
