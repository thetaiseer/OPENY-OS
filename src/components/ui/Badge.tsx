interface BadgeProps {
  label: string;
  color?: "blue" | "green" | "yellow" | "red" | "gray" | "purple";
}

const colors = {
  blue: { background: 'rgba(79,142,247,0.15)', color: '#4f8ef7' },
  green: { background: 'rgba(52,211,153,0.15)', color: '#34d399' },
  yellow: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
  red: { background: 'rgba(248,113,113,0.15)', color: '#f87171' },
  gray: { background: 'rgba(136,136,160,0.15)', color: '#8888a0' },
  purple: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
};

export function Badge({ label, color = "gray" }: BadgeProps) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={colors[color]}
    >
      {label}
    </span>
  );
}
