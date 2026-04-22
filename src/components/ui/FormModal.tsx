'use client';

import AppModal from '@/components/ui/AppModal';

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
}

export default function FormModal({
  open,
  onClose,
  onSubmit,
  title,
  subtitle,
  icon,
  size = 'md',
  children,
  footer,
  bodyClassName,
}: FormModalProps) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={icon}
      size={size}
      bodyClassName={bodyClassName}
      footer={footer}
    >
      {onSubmit ? <form onSubmit={onSubmit} className="openy-modal-stack">{children}</form> : children}
    </AppModal>
  );
}
