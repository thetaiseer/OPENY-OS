'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
  [key: string]: unknown;
};

type SelectDropdownProps = {
  value?: string;
  options?: SelectOption[];
  onChange?: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
  className?: string;
  [key: string]: unknown;
};

export default function SelectDropdown({
  value,
  options = [],
  onChange,
  placeholder,
  fullWidth = false,
  className,
  ...props
}: SelectDropdownProps) {
  return (
    <select
      {...props}
      value={value ?? ''}
      className={cn(
        'h-10 rounded-control border border-border bg-surface px-3 text-sm text-primary outline-none focus:border-accent',
        fullWidth ? 'w-full' : 'w-auto min-w-[10rem]',
        className,
      )}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value} disabled={option.disabled}>
          {typeof option.label === 'string' ? option.label : option.value}
        </option>
      ))}
    </select>
  );
}
