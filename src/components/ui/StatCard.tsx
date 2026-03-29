"use client";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  change?: string;
  positive?: boolean;
  accent?: boolean;
}

export function StatCard({ label, value, icon: Icon, change, positive = true, accent }: StatCardProps) {
  const numericValue = typeof value === "number" ? value : undefined;

  return (
    <motion.div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background: accent ? 'rgba(79,142,247,0.12)' : 'rgba(24,24,31,0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${accent ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: accent
          ? '0 8px 24px rgba(79,142,247,0.15), inset 0 1px 0 rgba(79,142,247,0.1)'
          : '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="flex items-start justify-between">
        <motion.div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: accent ? 'rgba(79,142,247,0.25)' : 'rgba(255,255,255,0.06)',
            border: accent ? '1px solid rgba(79,142,247,0.3)' : '1px solid rgba(255,255,255,0.08)',
          }}
          whileHover={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 0.4 }}
        >
          <Icon size={18} color={accent ? '#4f8ef7' : 'var(--text-secondary)'} />
        </motion.div>
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
        <p className="text-2xl font-bold tracking-tight" style={{ color: accent ? '#4f8ef7' : 'var(--text-primary)' }}>
          {numericValue !== undefined ? (
            <AnimatedCounter value={numericValue} duration={700} />
          ) : (
            value
          )}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
      </div>
    </motion.div>
  );
}
