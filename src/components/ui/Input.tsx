'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  error?: ReactNode;
};

export function Input({ label, error, icon, id, className, ...props }: InputProps) {
  const input = (
    <div className="relative">
      {icon ? (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary">
          {icon}
        </span>
      ) : null}
      <input
        id={id}
        {...props}
        className={cn(
          'focus:ring-[color:var(--accent)]/15 h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-primary outline-none transition-colors placeholder:text-secondary focus:border-accent focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
          icon ? 'pl-9' : '',
          error ? 'focus:ring-[color:var(--danger)]/20 border-danger focus:border-danger' : '',
          className,
        )}
      />
    </div>
  );

  if (!label && !error) return input;
  return (
    <FormField label={label} error={error} htmlFor={id}>
      {input}
    </FormField>
  );
}

export function Textarea({ label, error, id, className, ...props }: TextareaProps) {
  const area = (
    <textarea
      id={id}
      {...props}
      className={cn(
        'focus:ring-[color:var(--accent)]/15 min-h-[110px] w-full rounded-control border border-border bg-surface px-3 py-2.5 text-sm text-primary outline-none transition-colors placeholder:text-secondary focus:border-accent focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
        error ? 'focus:ring-[color:var(--danger)]/20 border-danger focus:border-danger' : '',
        className,
      )}
    />
  );
  if (!label && !error) return area;
  return (
    <FormField label={label} error={error} htmlFor={id}>
      {area}
    </FormField>
  );
}

export function FormField({
  children,
  label,
  error,
  hint,
  htmlFor,
  className,
}: {
  children?: ReactNode;
  label?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-sm font-medium text-primary">
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
      {!error && hint ? <p className="text-xs text-secondary">{hint}</p> : null}
    </div>
  );
}

export function Field({
  children,
  label,
  error,
  htmlFor,
  className,
}: {
  children?: ReactNode;
  label?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  [key: string]: unknown;
}) {
  return (
    <FormField label={label} error={error} htmlFor={htmlFor} className={className}>
      {children}
    </FormField>
  );
}
