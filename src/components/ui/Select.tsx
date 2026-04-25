'use client';

import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Field } from '@/components/ui/Input';

export type SelectOption = {
  value: string;
  label: ReactNode;
};

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  error?: ReactNode;
  options?: SelectOption[];
};

export default function Select({
  label,
  error,
  id,
  options = [],
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <Field label={label} error={error} htmlFor={id}>
      <select
        id={id}
        {...props}
        className={cn(
          'focus:ring-[color:var(--accent)]/15 h-10 w-full rounded-control border border-border bg-surface px-3 text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2',
          error ? 'border-danger' : '',
          className,
        )}
      >
        {children}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
