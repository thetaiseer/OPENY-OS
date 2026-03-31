















import React from "react";

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  variant?: string;
  size?: string;
  icon?: React.ElementType;
  iconPosition?: string;
  disabled?: boolean;
  type?: "button" | "reset" | "submit";
  fullWidth?: boolean;
  className?: string;
}

export function Button({
  children, onClick, variant = "primary", size = "md", icon: Icon,
  iconPosition = "left", disabled, type = "button", fullWidth, className = ""
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-sm" };

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #4F6EF7 0%, #7C5CF6 100%)',
      color: 'white',
      border: 'none',
      boxShadow: '0 2px 12px rgba(79,110,247,0.30)'
    },
    secondary: {
      background: 'var(--panel)',
      color: 'var(--text)',
      border: '1.5px solid var(--border)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--muted)',
      border: '1px solid var(--border)'
    },
    destructive: {
      background: 'rgba(239,68,68,0.08)',
      color: '#ef4444',
      border: '1.5px solid rgba(239,68,68,0.20)'
    }
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={variants[variant]}>
      
      {Icon && iconPosition === "left" && <Icon size={size === "sm" ? 13 : 15} />}
      {children}
      {Icon && iconPosition === "right" && <Icon size={size === "sm" ? 13 : 15} />}
    </button>);

}