'use client';

import type { ReactNode } from 'react';

export type SelectOption = {
  value: string;
  label: ReactNode;
  [key: string]: any;
};

type SelectDropdownProps = {
  value?: any;
  options?: SelectOption[];
  onChange?: (value: any) => void;
  placeholder?: string;
  [key: string]: any;
};

export default function SelectDropdown({
  value,
  options = [],
  onChange,
  placeholder,
  ...props
}: SelectDropdownProps) {
  return (
    <select
      {...props}
      value={value ?? ''}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option, index) => (
        <option key={`${option.value}-${index}`} value={option.value}>
          {typeof option.label === 'string' ? option.label : option.value}
        </option>
      ))}
    </select>
  );
}
