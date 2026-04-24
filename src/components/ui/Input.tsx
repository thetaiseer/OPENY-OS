'use client';

import * as React from 'react';
import { cn } from '@/lib/cn';

const fieldClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--surface-glass)] px-3 text-sm text-[var(--text)] shadow-xs backdrop-blur-glass transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-[var(--text-placeholder)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:bg-[var(--surface-elevated)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60';

export const inputHeightClass = 'h-10';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cn(fieldClass, inputHeightClass, className)} {...props} />;
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(fieldClass, 'min-h-[5rem] resize-y py-2.5', className)}
      {...props}
    />
  );
});

export function Label({
  className,
  children,
  ...rest
}: React.LabelHTMLAttributes<HTMLLabelElement> & { children: React.ReactNode }) {
  return (
    <label
      className={cn('mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]', className)}
      {...rest}
    >
      {children}
    </label>
  );
}

export function Field({
  label,
  id,
  children,
  className,
}: {
  label?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={id ?? undefined} className="mb-1 block text-sm font-medium text-[var(--text)]">
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}
