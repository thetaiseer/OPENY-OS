'use client';

import type { ReactNode } from 'react';
import clsx from 'clsx';
import SelectDropdown, { type SelectOption } from '@/components/ui/SelectDropdown';
import MonthYearPicker from '@/components/ui/MonthYearPicker';

export function AppPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="docs-page-header">
      <div>
        <h1 className="docs-page-title">{title}</h1>
        {subtitle ? <p className="docs-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="docs-page-actions">{actions}</div> : null}
    </div>
  );
}

export function AppSectionCard({
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
      {(title || actions) ? (
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

export function AppInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('docs-input', props.className)} />;
}

export function AppTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('docs-textarea', props.className)} />;
}

export function AppSelect({
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

export function AppDateField({
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

export function AppTabs<T extends string>({
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

export function AppEmptyState({
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

export function AppLoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="docs-state docs-loading-state">{label}</div>;
}

export function AppErrorState({ message }: { message: string }) {
  return <div className="docs-state docs-error-state">{message}</div>;
}
