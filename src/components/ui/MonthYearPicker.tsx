'use client';

import { cn } from '@/lib/cn';

type MonthYearPickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  [key: string]: unknown;
};

export default function MonthYearPicker({
  value = '',
  onChange,
  className,
  ...props
}: MonthYearPickerProps) {
  return (
    <input
      {...props}
      type="month"
      value={value}
      className={cn(
        'h-10 rounded-control border border-border bg-surface px-3 text-sm text-primary outline-none focus:border-accent',
        className,
      )}
      onChange={(event) => {
        onChange?.(event.target.value);
      }}
    />
  );
}
