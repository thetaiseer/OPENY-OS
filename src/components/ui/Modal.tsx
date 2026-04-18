'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

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
      className="openy-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ animation: 'openy-overlay-in 220ms ease both' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`openy-modal-panel w-full ${widthMap[size]} min-h-[78dvh] max-h-[92dvh] rounded-2xl flex flex-col`}
          style={{
            animation: 'openy-modal-in 320ms var(--ease-spring) both',
          }}
      >
        <div
          className="flex items-center justify-between px-5 sm:px-6 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2
            className="text-base font-bold tracking-tight"
            style={{ color: 'var(--text)' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close"
          >
            <X size={17} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
