import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className, ...props }: InputProps) {
  return <input className={clsx('ds-input', className)} {...props} />;
}
