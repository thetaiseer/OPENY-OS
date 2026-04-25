'use client';

import {
  type ChangeEvent,
  Children,
  type ReactNode,
  type SelectHTMLAttributes,
  isValidElement,
} from 'react';
import SelectDropdown, { type SelectOption } from '@/components/ui/SelectDropdown';

function optionsFromChildren(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  Children.forEach(children, (node) => {
    if (isValidElement(node) && node.type === 'option') {
      const p = node.props as { value?: string | number; children?: ReactNode; disabled?: boolean };
      out.push({
        value: p.value === undefined || p.value === null ? '' : String(p.value),
        label: p.children ?? String(p.value ?? ''),
        disabled: p.disabled,
      });
    }
  });
  return out;
}

type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'children' | 'multiple' | 'size'
> & {
  label?: ReactNode;
  error?: ReactNode;
  options?: SelectOption[];
  children?: ReactNode;
};

export default function Select({
  label,
  error,
  id,
  options = [],
  className,
  children,
  value,
  defaultValue,
  onChange,
  ...rest
}: SelectProps) {
  const childOpts = optionsFromChildren(children ?? null);
  const merged: SelectOption[] = childOpts.length > 0 ? childOpts : options;
  const resolvedValue = value !== undefined ? value : defaultValue;

  return (
    <SelectDropdown
      {...rest}
      id={id}
      label={label}
      error={error}
      className={className}
      options={merged}
      value={resolvedValue as string | number | null | undefined}
      fullWidth
      onChange={(str) => {
        onChange?.({ target: { value: str } } as unknown as ChangeEvent<HTMLSelectElement>);
      }}
    />
  );
}
