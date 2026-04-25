'use client';

import type { ReactNode, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Field } from '@/components/ui/Input';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type SelectDropdownProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> & {
  value?: string | number | null;
  options?: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: ReactNode;
  error?: ReactNode;
  fullWidth?: boolean;
  clearable?: boolean;
};

export default function SelectDropdown({
  value,
  options = [],
  onChange,
  placeholder,
  label,
  error,
  fullWidth = false,
  clearable = false,
  className,
  ...props
}: SelectDropdownProps) {
  const select = (
    <select
      {...props}
      value={value ?? ''}
      className={cn(
        'focus:ring-[color:var(--accent)]/15 h-10 rounded-control border border-border bg-surface px-3 text-sm text-primary outline-none transition-colors focus:border-accent focus:ring-2',
        fullWidth ? 'w-full' : 'min-w-[10rem]',
        error ? 'focus:ring-[color:var(--danger)]/20 border-danger focus:border-danger' : '',
        className,
      )}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    >
      {placeholder || clearable ? (
        <option value="">{placeholder ?? 'Select an option'}</option>
      ) : null}
      {options.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value} disabled={option.disabled}>
          {typeof option.label === 'string' ? option.label : option.value}
        </option>
      ))}
    </select>
  );

  if (!label && !error) return select;
  return (
    <Field label={label} error={error}>
      {select}
    </Field>
  );
}
