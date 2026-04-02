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

  if (!open) return null;

  const widthMap = { sm: 'max-w-sm', md: 'max-w-xl', lg: 'max-w-2xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`w-full ${widthMap[size]} rounded-2xl border shadow-xl max-h-[90vh] flex flex-col`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
