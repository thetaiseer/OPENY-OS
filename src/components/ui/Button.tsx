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
  sm: 'min-h-9 px-4 py-2 text-xs gap-1.5',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-sm',
  icon: 'h-11 w-11 min-h-11 min-w-11 shrink-0 rounded-full p-0',
};

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'border border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90',
  secondary:
    'border-[1.5px] border-border bg-transparent text-[color:var(--text-primary)] hover:bg-[color:var(--surface-soft)]',
  ghost:
    'border border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]',
  danger:
    'border border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] hover:opacity-90',
};

export default function Button({
  children,
  loading = false,
  disabled,
  variant,
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  const resolvedSize = (size in SIZE_CLASS ? size : 'md') as keyof typeof SIZE_CLASS;
  const requestedVariant = (
    variant && variant in VARIANT_CLASS ? variant : 'secondary'
  ) as keyof typeof VARIANT_CLASS;
  const possibleText = `${String(props['aria-label'] ?? '')} ${String(props.title ?? '')} ${
    typeof children === 'string' ? children : ''
  }`;
  const isDeleteIntent = /(delete|remove|حذف|مسح)/i.test(possibleText);
  const resolvedVariant = (
    isDeleteIntent ? 'danger' : requestedVariant
  ) as keyof typeof VARIANT_CLASS;

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'focus-visible:ring-[color:var(--accent)]/30 inline-flex items-center justify-center gap-2 rounded-2xl font-medium leading-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
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
