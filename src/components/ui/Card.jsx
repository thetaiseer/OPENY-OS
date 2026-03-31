"use client";
import { motion } from "framer-motion";

import { useTheme } from "@/components/layout/ThemeProvider";










export function Card({ children, className = "", padding = "md", elevated, interactive }) {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const paddings = { sm: "p-4", md: "p-5", lg: "p-6" };

  const baseStyle = {
    background: 'var(--panel)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: elevated ? 'var(--shadow-md)' : 'var(--shadow)'
  };

  const hoverShadow = isLight ?
  '0 8px 24px rgba(100,116,139,0.12), 0 2px 8px rgba(100,116,139,0.06)' :
  '0 12px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)';

  if (interactive) {
    return (
      <motion.div
        className={`${paddings[padding]} ${className} card`}
        style={baseStyle}
        whileHover={{ y: -2, boxShadow: hoverShadow }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}>
        
        {children}
      </motion.div>);

  }

  return (
    <div
      className={`${paddings[padding]} ${className} card`}
      style={baseStyle}>
      
      {children}
    </div>);

}