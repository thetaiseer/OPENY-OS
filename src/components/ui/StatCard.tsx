"use client";
import { motion } from "framer-motion";

import { AnimatedCounter } from "./AnimatedCounter";
import { useTheme } from "@/components/layout/ThemeProvider";










export function StatCard({ label, value, icon: Icon, change, positive = true, accent = false }: { label?: string; value?: any; icon?: any; change?: string; positive?: boolean; accent?: boolean }) {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const numericValue = typeof value === "number" ? value : undefined;

  const cardBg = accent ?
  isLight ? 'rgba(91,141,238,0.07)' : 'rgba(79,142,247,0.12)' :
  'var(--glass-stat)';

  const cardBorder = accent ?
  isLight ? 'rgba(91,141,238,0.20)' : 'rgba(79,142,247,0.25)' :
  'var(--border)';

  const cardShadow = accent ?
  isLight ?
  '0 8px 24px rgba(91,141,238,0.08), 0 2px 6px rgba(91,141,238,0.04)' :
  '0 8px 24px rgba(79,142,247,0.15), inset 0 1px 0 rgba(79,142,247,0.1)' :
  'var(--shadow-sm)';

  const hoverShadow = accent ?
  isLight ?
  '0 12px 32px rgba(91,141,238,0.12), 0 4px 10px rgba(91,141,238,0.06)' :
  '0 12px 32px rgba(79,142,247,0.20)' :
  isLight ?
  '0 8px 24px rgba(100,116,139,0.12), 0 2px 8px rgba(100,116,139,0.06)' :
  '0 12px 32px rgba(0,0,0,0.35)';

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: cardBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${cardBorder}`,
        boxShadow: cardShadow
      }}
      whileHover={{ scale: 1.02, y: -2, boxShadow: hoverShadow }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}>
      
      <div className="flex items-start justify-between">
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: accent ?
            isLight ? 'rgba(91,141,238,0.12)' : 'rgba(79,142,247,0.25)' :
            'var(--glass-stat-icon)',
            border: `1px solid ${accent ?
            isLight ? 'rgba(91,141,238,0.20)' : 'rgba(79,142,247,0.3)' :
            'var(--glass-stat-icon-border)'}`
          }}
          whileHover={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.4 }}>
          
          <Icon size={18} color={accent ? 'var(--accent)' : 'var(--text-secondary)'} />
        </motion.div>
        {change &&
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: positive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            color: positive ? 'var(--success)' : 'var(--error)'
          }}>
          
            {change}
          </span>
        }
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight" style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)' }}>
          {numericValue !== undefined ?
          <AnimatedCounter value={numericValue} duration={700} /> :

          value
          }
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </motion.div>);

}