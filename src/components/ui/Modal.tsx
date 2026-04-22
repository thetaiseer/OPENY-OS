'use client';

import AppModal from '@/components/ui/AppModal';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  return (
    <AppModal open={open} onClose={onClose} title={title} size={size}>
      {children}
    </AppModal>
  );
}
