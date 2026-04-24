'use client';

import AppModal from '@/components/ui/AppModal';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeOnBackdrop?: boolean;
  hideHeader?: boolean;
}

/**
 * Unified modal — delegates to AppModal (portal, focus trap, motion).
 * Prefer composing `footer` with `Button` for consistent actions.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  closeOnBackdrop,
  hideHeader,
}: ModalProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size={size}
      footer={footer}
      closeOnBackdrop={closeOnBackdrop}
      hideHeader={hideHeader}
    >
      {children}
    </AppModal>
  );
}
