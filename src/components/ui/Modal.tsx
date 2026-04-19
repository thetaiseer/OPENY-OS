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
 * Closes on Escape key and backdrop click. Locks body scroll while open.
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

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  /* Lock body scroll */
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="ui-modal-backdrop"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div ref={dialogRef} className="ui-modal" style={{ maxWidth }}>
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
      </div>
    </div>
  );
}

