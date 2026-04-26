'use client';

import type { FormEvent, ReactNode } from 'react';
import AppModal from '@/components/ui/AppModal';

type FormModalProps = {
  open?: boolean;
  onClose?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
} & Record<string, unknown>;

export default function FormModal({ onSubmit, children, ...props }: FormModalProps) {
  return (
    <AppModal {...props}>
      {onSubmit ? <form onSubmit={onSubmit}>{children}</form> : children}
    </AppModal>
  );
}
