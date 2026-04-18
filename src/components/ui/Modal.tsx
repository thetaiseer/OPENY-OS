'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-[min(760px,calc(100vw-1.5rem))]',
  md: 'max-w-[min(1024px,calc(100vw-1.5rem))]',
  lg: 'max-w-[min(1280px,calc(100vw-1.5rem))]',
};

export default function Modal({ open, onClose, title, subtitle, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="openy-modal-overlay fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-2.5 sm:items-center sm:p-6" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`openy-modal-shell w-full ${sizeClasses[size]} overflow-hidden rounded-2xl`} style={{ animation: 'openy-modal-in 260ms var(--ease-spring) both' }}>
        <div className="openy-modal-header flex items-start justify-between gap-3 border-b px-4 py-3.5 sm:px-6 sm:py-4" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} className="btn-icon openy-modal-close" aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="openy-modal-body max-h-[calc(100dvh-6rem)] overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
