'use client';

import { AlertTriangle } from 'lucide-react';
import AppModal from '@/components/ui/AppModal';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: ConfirmModalProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      icon={<AlertTriangle size={15} />}
      size="sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="openy-modal-btn-secondary">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="openy-modal-btn-primary disabled:opacity-50"
            style={danger ? { background: 'var(--modal-color-danger)' } : undefined}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </>
      )}
    >
      {description && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
      )}
    </AppModal>
  );
}
