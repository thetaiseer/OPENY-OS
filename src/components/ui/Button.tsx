import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ButtonProps {
  children?: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
  icon?: LucideIcon;
  iconPosition?: "left" | "right";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children, onClick, variant = "primary", size = "md", icon: Icon,
  iconPosition = "left", disabled, type = "button", fullWidth, className = "",
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-sm" };
  
  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: 'var(--accent)',
      color: 'white',
      border: 'none',
      boxShadow: '0 2px 8px var(--accent-dim)',
    },
    secondary: {
      background: 'var(--glass-overlay)',
      color: 'var(--text-primary)',
      border: '1px solid var(--glass-overlay-border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    },
    destructive: {
      background: 'rgba(239,68,68,0.10)',
      color: 'var(--error)',
      border: '1px solid rgba(239,68,68,0.22)',
    },
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={variants[variant]}
    >
      {Icon && iconPosition === "left" && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
      {Icon && iconPosition === "right" && <Icon size={size === "sm" ? 13 : 15} />}
    </button>
  );
}
