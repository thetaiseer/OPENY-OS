'use client';

import type { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
};

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  error?: ReactNode;
};

export function Input(props: InputProps) {
  return <input {...props} />;
}

export function Textarea(props: TextareaProps) {
  return <textarea {...props} />;
}

export function Field({ children }: { children?: ReactNode; [key: string]: any }) {
  return <div>{children}</div>;
}
