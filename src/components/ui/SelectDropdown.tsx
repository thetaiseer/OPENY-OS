'use client';

import { ChevronDown, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  icon?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  disabled = false,
  clearable = false,
  icon,
  className = '',
  fullWidth = false,
}: SelectDropdownProps) {
  return (
    <div className={`relative ${fullWidth ? 'w-full' : 'inline-block'}`}>
      <div className="openy-select-trigger relative flex h-10 items-center gap-2 rounded-lg px-3" style={{ width: fullWidth ? '100%' : undefined }}>
        {icon ? <span className="shrink-0 text-[var(--text-secondary)]">{icon}</span> : null}

        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={`h-full w-full appearance-none bg-transparent text-sm outline-none ${className}`}
          style={{ color: value ? 'var(--text)' : 'var(--text-secondary)' }}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={`${option.value}-${option.label}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {clearable && value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="shrink-0 rounded p-0.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-3)]"
            aria-label="Clear selection"
          >
            <X size={12} />
          </button>
        ) : (
          <ChevronDown size={14} className="shrink-0 text-[var(--text-secondary)]" />
        )}
      </div>
    </div>
  );
}
