'use client';

import type { ReactNode } from 'react';
import AppModal from '@/components/ui/AppModal';

type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  [key: string]: any;
};

export default function Modal({ children, ...props }: ModalProps) {
  return <AppModal {...props}>{children}</AppModal>;
}
