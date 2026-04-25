'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import Button from '@/components/ui/Button';

type AppModalProps = {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bodyClassName?: string;
  closeLabel?: string;
  [key: string]: any;
};

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export default function AppModal({
  open = true,
  onClose,
  title,
  subtitle,
  footer,
  children,
  size = 'md',
  bodyClassName,
  closeLabel = 'Close modal',
}: AppModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <section
        className={cn(
          'w-full rounded-t-card border border-border bg-elevated shadow-soft md:rounded-card',
          sizeClasses[size],
        )}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || subtitle || onClose) && (
          <header className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div className="space-y-1">
              {title ? <h2 className="text-lg font-semibold text-primary">{title}</h2> : null}
              {subtitle ? <p className="text-sm text-secondary">{subtitle}</p> : null}
            </div>
            {onClose ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={closeLabel}
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </header>
        )}
        <div className={cn('max-h-[70vh] overflow-auto p-4', bodyClassName)}>{children}</div>
        {footer ? <footer className="border-t border-border p-4">{footer}</footer> : null}
      </section>
    </div>
  );
}
