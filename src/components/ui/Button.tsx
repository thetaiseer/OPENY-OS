'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  loading?: boolean;
  variant?: string;
  size?: string;
};

export default function Button({ children, loading, disabled, ...props }: ButtonProps) {
  return (
    <button {...props} disabled={disabled || loading}>
      {children}
    </button>
  );
}
