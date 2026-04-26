'use client';

'use client';

import type { InputHTMLAttributes } from 'react';

type MonthYearPickerProps = {
  value?: string;
  onChange?: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'>;

export default function MonthYearPicker({ value = '', onChange, ...props }: MonthYearPickerProps) {
  return (
    <input
      {...props}
      type="month"
      value={value}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    />
  );
}
