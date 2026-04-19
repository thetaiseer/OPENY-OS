'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  /** Controls visibility */
  open: boolean;
  /** Called when the user requests to close the modal */
  onClose: () => void;
  title: string;
  /** Optional subtitle shown below the title */
  description?: string;
  /** Modal body */
  children?: ReactNode;
  /** Footer slot — typically action buttons */
  footer?: ReactNode;
  /** Max width (default 520px) */
  maxWidth?: number | string;
}

/**
 * Modal — accessible dialog with backdrop.
 * Closes on Escape key and backdrop click.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 520,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
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

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
لا    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Lock body scroll */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="ui-modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={dialogRef}
        className="ui-modal"
        style={{ maxWidth }}
      >
        {/* Header */}
        <div className="ui-modal-header">
          <div>
            <div id="modal-title" className="ui-modal-title">{title}</div>
            {description && (
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {description}
              </p>
            )}
          </div>
          <button
            className="ui-icon-btn"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ flexShrink: 0 }}
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
        {children && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {children}
          </div>
        )}

        {/* Footer */}
        {footer && <div className="ui-modal-footer">{footer}</div>}
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
