'use client';

import type { FormEvent, ReactNode } from 'react';
import AppModal from '@/components/ui/AppModal';

type FormModalProps = {
  open?: boolean;
  onClose?: () => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
  [key: string]: any;
};

export default function FormModal({ onSubmit, children, ...props }: FormModalProps) {
  return (
    <AppModal {...props}>
      {onSubmit ? (
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
        </form>
      ) : (
        children
      )}
    </AppModal>
  );
}
