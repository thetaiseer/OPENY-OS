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
          'rounded-control border-border bg-surface text-primary focus:border-accent h-10 w-full border px-3 text-sm outline-none transition-colors',
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
