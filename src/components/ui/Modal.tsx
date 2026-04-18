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

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}: ModalProps) {
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

  const widthMap = {
    sm: 'max-w-[min(760px,calc(100vw-1.5rem))]',
    md: 'max-w-[min(1024px,calc(100vw-1.5rem))]',
    lg: 'max-w-[min(1280px,calc(100vw-1.5rem))]',
  };

  return (
    <div
      className="openy-modal-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2.5 sm:p-6 overflow-y-auto"
      style={{ animation: 'openy-overlay-in 220ms ease both' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`openy-modal-panel openy-modal-shell w-full ${widthMap[size]} rounded-2xl flex flex-col h-auto max-h-[calc(100dvh-0.5rem)] sm:max-h-[calc(100dvh-3rem)] my-auto overflow-hidden`}
          style={{
             animation: 'openy-modal-in 320ms var(--ease-spring) both',
           }}
      >
        <div
          className="openy-modal-header flex items-start justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="min-w-0">
            <h2
              className="text-[0.98rem] sm:text-base font-semibold tracking-tight leading-snug"
              style={{ color: 'var(--text)' }}
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs sm:text-[0.8rem] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-icon openy-modal-close"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="openy-modal-body flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
