'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

type AppModalProps = {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bodyClassName?: string;
  zIndexClassName?: string;
  panelClassName?: string;
  hideCloseButton?: boolean;
  hideHeader?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<AppModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export default function AppModal({
  open = true,
  onClose,
  children,
  footer,
  title,
  subtitle,
  icon,
  size = 'md',
  bodyClassName,
  zIndexClassName = 'z-50',
  panelClassName,
  hideCloseButton = false,
  hideHeader = false,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className,
}: AppModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={cn('fixed inset-0', zIndexClassName)}>
      <button
        type="button"
        aria-label="Close modal backdrop"
        className="openy-modal-backdrop bg-[color:var(--openy-deep)]/62 absolute inset-0 backdrop-blur-[2px]"
        onClick={() => {
          if (closeOnOverlayClick) onClose?.();
        }}
      />

      <div className="relative flex h-full max-h-screen-dynamic items-center justify-center px-[max(0.75rem,env(safe-area-inset-left,0px))] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pl-[max(0.75rem,env(safe-area-inset-left,0px))] pr-[max(0.75rem,env(safe-area-inset-right,0px))] pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          className={cn(
            'openy-elevated openy-modal-panel flex max-h-modal-dynamic w-full flex-col overflow-hidden rounded-xl text-[color:var(--text-primary)]',
            SIZE_CLASS[size],
            panelClassName,
            className,
          )}
        >
          {!hideHeader && (title || subtitle || icon || !hideCloseButton) && (
            <div
              className="flex items-start justify-between gap-3 border-b px-5 py-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="min-w-0">
                {title ? (
                  <div className="flex items-center gap-2">
                    {icon ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[color:var(--accent-soft)] text-[color:var(--accent)]">
                        {icon}
                      </span>
                    ) : null}
                    <h3
                      className="truncate text-base font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {title}
                    </h3>
                  </div>
                ) : null}
                {subtitle ? (
                  <p className="mt-1 text-sm text-[color:var(--text-secondary)]">{subtitle}</p>
                ) : null}
              </div>

              {!hideCloseButton ? (
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition-colors hover:bg-[var(--surface-2)] hover:text-[color:var(--text-primary)]"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              ) : null}
            </div>
          )}

          <div
            className={cn(
              'min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[color:var(--text-primary)]',
              bodyClassName,
            )}
          >
            {children}
          </div>

          {footer ? (
            <div
              className="flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3"
              style={{ borderColor: 'var(--border)' }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
