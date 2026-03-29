"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  elevated?: boolean;
  /** When true, card has a subtle hover lift effect */
  interactive?: boolean;
}

export function Card({ children, className = "", padding = "md", elevated, interactive }: CardProps) {
  const paddings = { sm: "p-4", md: "p-5", lg: "p-6" };
  const baseStyle = {
    background: elevated ? 'rgba(20,20,28,0.90)' : 'rgba(24,24,31,0.75)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1px solid rgba(255,255,255,0.07)',
    boxShadow: elevated
      ? '0 16px 48px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.06)'
      : '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
  } as React.CSSProperties;

  if (interactive) {
    return (
      <motion.div
        className={`rounded-2xl ${paddings[padding]} ${className} glass-card`}
        style={baseStyle}
        whileHover={{ y: -2, boxShadow: '0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)' }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div
      className={`rounded-2xl ${paddings[padding]} ${className} glass-card`}
      style={baseStyle}
    >
      {children}
    </div>
  );
}
