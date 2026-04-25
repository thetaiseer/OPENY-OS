'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | string;
  size?: 'sm' | 'md' | 'lg' | 'icon' | string;
};

const SIZE_CLASS: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
};

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)] hover:bg-[color:var(--accent-hover)]',
  secondary: 'border-border bg-surface text-primary hover:bg-[color:var(--surface-elevated)]',
  ghost:
    'border-transparent bg-transparent text-secondary hover:bg-[color:var(--surface-elevated)]',
  danger: 'border-[color:var(--danger)] bg-[color:var(--danger)] text-white hover:brightness-95',
};

export default function Button({
  children,
  loading = false,
  disabled,
  variant = 'secondary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const resolvedSize = (size in SIZE_CLASS ? size : 'md') as keyof typeof SIZE_CLASS;
  const resolvedVariant = (
    variant in VARIANT_CLASS ? variant : 'secondary'
  ) as keyof typeof VARIANT_CLASS;

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'focus-visible:ring-[color:var(--accent)]/35 inline-flex items-center justify-center gap-2 rounded-control border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
        SIZE_CLASS[resolvedSize],
        VARIANT_CLASS[resolvedVariant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}
