'use client';

import type { ReactNode } from 'react';

type AppModalProps = {
  open?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  [key: string]: any;
};

export default function AppModal({ open = true, children }: AppModalProps) {
  if (!open) return null;
  return <div>{children}</div>;
}
