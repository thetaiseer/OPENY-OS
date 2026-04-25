'use client';

import type { TextareaHTMLAttributes } from 'react';
import { Textarea as BaseTextarea } from '@/components/ui/Input';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

export default function Textarea(props: Props) {
  return <BaseTextarea {...props} />;
}
