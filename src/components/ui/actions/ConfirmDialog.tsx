'use client';

import { useMemo } from 'react';
import AppModal from '@/components/ui/AppModal';
import Button from '@/components/ui/Button';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmVariant = useMemo(() => (destructive ? 'danger' : 'primary'), [destructive]);

  const handleConfirm = () => {
    if (loading) return;
    void onConfirm();
  };

  return (
    <AppModal
      open={open}
      onClose={() => {
        if (loading) return;
        onCancel();
      }}
      title={title}
      subtitle={description}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            loading={loading}
            disabled={loading}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    />
  );
}
