'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';

type GlassModalSize = 'sm' | 'md' | 'lg';

interface GlassModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: GlassModalSize;
}

const sizeClass: Record<GlassModalSize, string> = {
  sm: 'max-w-lg',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
};

export default function GlassModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: GlassModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <motion.div
            className={clsx(
              'w-full overflow-hidden rounded-3xl border border-white/5 bg-white shadow-md backdrop-blur-2xl dark:bg-[#0A0A0A]',
              sizeClass[size],
            )}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5 dark:border-white/10">
              <div>
                <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {title}
                </h2>
                {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">{description}</p> : null}
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                aria-label="Close modal"
                className="rounded-xl border border-black/10 p-2 text-slate-700 transition-colors hover:bg-black/5 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/10"
                onClick={onClose}
              >
                <X size={16} />
              </motion.button>
            </header>
            <div
              className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-6 py-5"
              role="region"
              aria-label={`${title} content`}
            >
              {children}
            </div>
            {footer ? <footer className="border-t border-black/5 px-6 py-4 dark:border-white/10">{footer}</footer> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
