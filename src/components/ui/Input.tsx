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

export function Input({ label, error, icon, className, id, ...props }: InputProps) {
  return (
    <Field label={label} error={error} htmlFor={id}>
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
            'h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-primary outline-none transition-colors placeholder:text-secondary focus:border-accent',
            icon ? 'pl-9' : '',
            error ? 'border-danger' : '',
            className,
          )}
        />
      </div>
    </Field>
  );
}

export function Textarea({ label, error, className, id, rows = 4, ...props }: TextareaProps) {
  return (
    <Field label={label} error={error} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        {...props}
        className={cn(
          'w-full resize-y rounded-control border border-border bg-surface px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-secondary focus:border-accent',
          error ? 'border-danger' : '',
          className,
        )}
      />
    </Field>
  );
}

type FieldProps = {
  children?: ReactNode;
  label?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  id?: string;
  className?: string;
};

export function Field({ children, label, error, htmlFor, id, className }: FieldProps) {
  return (
    <label className={cn('flex w-full flex-col gap-1.5', className)} htmlFor={htmlFor ?? id}>
      {label ? <span className="text-sm font-medium text-primary">{label}</span> : null}
      {children}
      {error ? <span className="text-xs text-danger">{error}</span> : null}
    </label>
  );
}
