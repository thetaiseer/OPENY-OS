import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  elevated?: boolean;
}

export function Card({ children, className = "", padding = "md", elevated }: CardProps) {
  const paddings = { sm: "p-4", md: "p-5", lg: "p-6" };
  return (
    <div
      className={`rounded-2xl ${paddings[padding]} ${className} glass-card`}
      style={{
        background: elevated ? 'rgba(20,20,28,0.90)' : 'rgba(24,24,31,0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: elevated
          ? '0 16px 48px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)'
          : '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {children}
    </div>
  );
}
