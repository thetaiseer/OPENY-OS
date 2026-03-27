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
      className={`rounded-2xl ${paddings[padding]} ${className}`}
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        boxShadow: elevated ? '0 8px 32px rgba(0,0,0,0.2)' : 'none',
      }}
    >
      {children}
    </div>
  );
}
