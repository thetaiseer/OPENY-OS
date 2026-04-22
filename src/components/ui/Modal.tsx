'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { motionTransition } from '@/lib/motion';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const widthMap = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: 'rgba(3,10,24,0.52)', backdropFilter: 'var(--blur-overlay)', WebkitBackdropFilter: 'var(--blur-overlay)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransition.modal}
        >
          <motion.div
            className={`w-full ${widthMap[size]} rounded-t-3xl sm:rounded-3xl border max-h-[92dvh] sm:max-h-[90vh] flex flex-col`}
            style={{
              background: 'var(--surface-elevated)',
              backdropFilter: 'var(--blur-panel)',
              WebkitBackdropFilter: 'var(--blur-panel)',
              borderColor: 'var(--border-glass)',
              boxShadow: 'var(--shadow-lg), var(--highlight-inset)',
            }}
            initial={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95, y: 10, filter: 'blur(6px)' }}
            transition={motionTransition.modal}
          >
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <h2
                className="text-lg font-bold"
                style={{ color: 'var(--text)', letterSpacing: '-0.015em' }}
              >
                {title}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
