'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';
import SelectDropdown, { type SelectOption } from '@/components/ui/SelectDropdown';
import MonthYearPicker from '@/components/ui/MonthYearPicker';

export function DocsPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="app-page-header">
      <div>
        <h1 className="app-page-title">{title}</h1>
        {subtitle ? <p className="app-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function DocsSectionCard({
  title,
  subtitle,
  children,
  actions,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx('docs-card', className)}>
      {title || actions ? (
        <div className="docs-card-header">
          <div>
            {title ? <h2 className="docs-card-title">{title}</h2> : null}
            {subtitle ? <p className="docs-card-subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function DocsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('docs-input', props.className)} />;
}

export function DocsTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('docs-textarea', props.className)} />;
}

export function DocsSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  return (
    <SelectDropdown
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      fullWidth
    />
  );
}

export function DocsDateField({
  value,
  onChange,
  mode = 'date',
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  mode?: 'date' | 'month';
  placeholder?: string;
}) {
  if (mode === 'month') {
    return (
      <MonthYearPicker
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? 'Select month'}
      />
    );
  }
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="docs-input"
    />
  );
}

export function DocsTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="docs-tabs">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={clsx('docs-tab', value === item.value && 'docs-tab-active')}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function DocsEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="docs-state docs-empty-state">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function DocsLoadingState({ label = 'Loading...' }: { label?: string }) {
  return <div className="docs-state docs-loading-state">{label}</div>;
}

export function DocsErrorState({ message }: { message: string }) {
  return <div className="docs-state docs-error-state">{message}</div>;
}
