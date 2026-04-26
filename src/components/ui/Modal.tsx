'use client';

import type { ReactNode } from 'react';
import AppModal from '@/components/ui/AppModal';

type ModalProps = {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
} & Record<string, unknown>;

export default function Modal(props: ModalProps) {
  return <AppModal {...props}>{props.children}</AppModal>;
}

export type { ModalProps };
