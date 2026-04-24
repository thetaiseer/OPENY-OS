'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl text-sm font-semibold tracking-tight transition-[transform,box-shadow,opacity,background-color,color,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

const variants: Record<ButtonVariant, string> = {
  primary:
    'h-10 border border-transparent bg-[linear-gradient(135deg,var(--accent)_0%,color-mix(in_srgb,var(--accent)_78%,var(--accent-3))_100%)] px-4 text-[var(--accent-contrast)] shadow-sm [box-shadow:var(--shadow-sm),var(--glow-accent-sm),inset_0_1px_0_rgba(255,255,255,0.22)] hover:opacity-[0.94] hover:shadow-md',
  secondary:
    'h-10 border border-[var(--border-glass)] bg-[var(--surface-glass)] px-4 text-[var(--text)] shadow-xs backdrop-blur-glass hover:-translate-y-px hover:bg-[var(--surface-elevated)] hover:shadow-sm',
  ghost:
    'h-10 border border-transparent bg-transparent px-4 text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]',
  danger:
    'h-10 border border-transparent bg-[linear-gradient(135deg,var(--color-danger)_0%,color-mix(in_srgb,var(--color-danger)_78%,#7f1d1d)_100%)] px-4 text-white shadow-sm hover:opacity-[0.92] hover:shadow-md',
};

export type ButtonProps = {
  variant?: ButtonVariant;
  className?: string;
  /** Renders as Next.js Link with button styling */
  href?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, href, type = 'button', children, ...props },
  ref,
) {
  const cls = cn(base, variants[variant], className);

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }

  return (
    <button ref={ref} type={type} className={cls} {...props}>
      {children}
    </button>
  );
});

export default Button;
