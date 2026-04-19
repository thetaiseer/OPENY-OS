import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  suggestions?: Array<{
    title: string;
    description?: string;
    action?: React.ReactNode;
  }>;
}

export default function EmptyState({ icon: Icon, title, description, action, suggestions }: EmptyStateProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="animate-openy-fade-in flex flex-col items-center justify-center gap-5 overflow-hidden rounded-3xl border border-black/5 bg-white px-8 py-16 text-center shadow-sm dark:border-white/10 dark:bg-[#0A0A0A]/90 dark:shadow-none"
    >
      <div className="pointer-events-none relative">
        <span className="absolute -left-6 top-1 h-12 w-12 rounded-full bg-slate-300/20 blur-xl dark:bg-white/20" />
        <span className="absolute -right-6 -top-2 h-14 w-14 rounded-full bg-blue-300/20 blur-2xl dark:bg-blue-400/20" />
        <div className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-black/10 bg-black/[0.03] text-slate-900 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100">
          <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
        </div>
      </div>

      <div>
        <h3 className="text-[19px] font-bold tracking-tight text-slate-900 dark:text-slate-50">
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-slate-600 dark:text-slate-300">
          {description}
        </p>
      </div>

      {action ? <div>{action}</div> : null}

      {suggestions && suggestions.length > 0 ? (
        <div className="mx-auto mt-2 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.title}
              className="rounded-2xl border border-black/5 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]"
            >
              <p className="text-[13px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {suggestion.title}
              </p>
              {suggestion.description ? (
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {suggestion.description}
                </p>
              ) : null}
              {suggestion.action ? <div className="mt-2">{suggestion.action}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </motion.div>
  );
}
