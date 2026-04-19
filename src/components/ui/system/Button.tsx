import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return <button className={clsx('ds-button', `ds-button--${variant}`, className)} {...props} />;
}
