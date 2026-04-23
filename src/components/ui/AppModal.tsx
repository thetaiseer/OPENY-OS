'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    const previous = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';

    const getFocusable = () => {
      const root = panelRef.current;
      if (!root) return [] as HTMLElement[];
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
    };

    requestAnimationFrame(() => {
      const first = getFocusable()[0];
      (first ?? closeButtonRef.current)?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = getFocusable();
      if (!focusables.length) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (!current || current === first || !panelRef.current?.contains(current)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (!current || current === last || !panelRef.current?.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      previouslyFocused?.focus?.();
    };
  }, [closeOnEscape, mounted, onClose, open]);

  const shouldRenderHeader = !hideHeader && (title || subtitle || icon);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={`fixed inset-0 ${zIndexClassName} openy-modal-overlay flex items-center justify-center p-4`}
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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={`openy-modal-panel w-full ${widthMap[size]} flex max-h-[92dvh] flex-col rounded-[var(--modal-radius)] ${panelClassName}`}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={motionTransition.modal}
          >
            {shouldRenderHeader && (
              <div className="openy-modal-header shrink-0">
                <div className="flex min-w-0 items-center gap-2.5">
                  {icon && (
                    <div
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
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
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="openy-modal-close shrink-0"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <div className={`openy-modal-body flex-1 overflow-y-auto ${bodyClassName}`}>
              {children}
            </div>

            {footer && <div className="openy-modal-footer shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
