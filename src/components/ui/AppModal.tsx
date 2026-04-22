'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { motionTransition } from '@/lib/motion';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const widthMap: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  hideHeader?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
  zIndexClassName?: string;
}

export default function AppModal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideHeader = false,
  panelClassName = '',
  bodyClassName = '',
  zIndexClassName = 'z-50',
}: AppModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [closeOnEscape, onClose, open]);

  const shouldRenderHeader = !hideHeader && (title || subtitle || icon);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 ${zIndexClassName} openy-modal-overlay flex items-end sm:items-center justify-center p-0 sm:p-4`}
          onClick={(event) => {
            if (!closeOnBackdrop) return;
            if (event.target === event.currentTarget) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTransition.modal}
        >
          <motion.div
            className={`openy-modal-panel w-full ${widthMap[size]} rounded-t-3xl sm:rounded-[var(--modal-radius)] max-h-[92dvh] flex flex-col ${panelClassName}`}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={motionTransition.modal}
          >
            {shouldRenderHeader && (
              <div className="openy-modal-header shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  {icon && (
                    <div
                      className="w-8 h-8 rounded-xl inline-flex items-center justify-center shrink-0"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && <p className="openy-modal-title truncate">{title}</p>}
                    {subtitle && <p className="openy-modal-subtitle truncate">{subtitle}</p>}
                  </div>
                </div>
                <button type="button" onClick={onClose} className="openy-modal-close shrink-0" aria-label="Close modal">
                  <X size={16} />
                </button>
              </div>
            )}

            <div className={`openy-modal-body overflow-y-auto flex-1 ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="openy-modal-footer shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
