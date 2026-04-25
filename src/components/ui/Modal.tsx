'use client';

import type { ReactNode } from 'react';
import AppModal from '@/components/ui/AppModal';

type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  [key: string]: any;
};

export default function Modal(props: ModalProps) {
  return <AppModal {...props}>{props.children}</AppModal>;
}
