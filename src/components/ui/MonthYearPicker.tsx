'use client';

import { Calendar, X } from 'lucide-react';

interface MonthYearPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export default function MonthYearPicker({
  value,
  onChange,
  placeholder = 'Select month',
  disabled = false,
  className = '',
  clearable = false,
}: MonthYearPickerProps) {
  return (
    <div className={`relative ${className.includes('w-full') ? 'w-full' : 'inline-block'}`}>
      <div className={`openy-select-trigger flex h-10 items-center gap-2 rounded-lg px-3 ${className}`}>
        <Calendar size={14} className="shrink-0 text-[var(--text-secondary)]" />

        <input
          type="month"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-full w-full bg-transparent text-sm outline-none"
          aria-label={placeholder}
        />

        {clearable && value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Clear month"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
