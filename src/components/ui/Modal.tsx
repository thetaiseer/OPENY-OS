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
  sm: 'max-w-[min(640px,calc(100vw-1.5rem))]',
  md: 'max-w-[min(940px,calc(100vw-1.5rem))]',
  lg: 'max-w-[min(1200px,calc(100vw-1.5rem))]',
};

export default function Modal({ open, onClose, title, subtitle, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="openy-modal-overlay fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-3 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`openy-modal-panel w-full ${sizeClasses[size]} overflow-hidden rounded-2xl`}
        style={{ animation: 'openy-modal-in 220ms var(--ease-spring) both' }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 border-b px-5 py-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <h2 className="text-[15px] font-700 tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
