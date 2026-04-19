import type { ButtonHTMLAttributes } from 'react';
import { ActionButton } from '@/components/ui/system/Primitives';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <ActionButton variant={variant} className={className} {...props} />;
}
