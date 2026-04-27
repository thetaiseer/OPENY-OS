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
  sm: 'min-h-10 px-4 py-2 text-sm',
  md: 'min-h-12 px-5 py-2.5 text-sm',
  lg: 'min-h-[3.25rem] px-7 py-3 text-sm',
  icon: 'h-12 w-12 min-h-12 min-w-12 shrink-0 p-0',
};

const VARIANT_CLASS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)] shadow-[0_10px_24px_rgba(37,99,235,0.24)] hover:bg-[color:var(--accent-hover)]',
  secondary:
    'border-border bg-[color:var(--surface-soft)] text-[color:var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_8px_22px_rgba(15,23,42,0.06)] hover:bg-[color:var(--surface-elevated)]',
  ghost:
    'border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--text-primary)]',
  danger:
    'border-[color:var(--danger)] bg-[color:var(--danger)] text-[color:var(--danger-foreground)] shadow-[0_10px_24px_rgba(220,38,38,0.2)] hover:brightness-95',
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
        'focus-visible:ring-[color:var(--accent)]/30 inline-flex items-center justify-center gap-2 rounded-control border font-medium leading-normal transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 active:translate-y-[1px] disabled:cursor-not-allowed disabled:border-[color:var(--border)] disabled:bg-[color:var(--surface-soft)] disabled:text-[color:var(--text-disabled)] disabled:opacity-100',
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
