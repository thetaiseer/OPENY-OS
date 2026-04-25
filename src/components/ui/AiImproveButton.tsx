'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';

type AiImproveButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  value?: string;
  onImproved?: (value: string) => void;
  showMenu?: boolean;
  mode?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export default function AiImproveButton({
  children,
  value = '',
  onImproved,
  variant = 'secondary',
  ...props
}: AiImproveButtonProps) {
  return (
    <Button
      {...props}
      type={props.type ?? 'button'}
      variant={variant}
      onClick={(event) => {
        props.onClick?.(event);
        if (onImproved) onImproved(value);
      }}
    >
      <Sparkles className="h-4 w-4" />
      {children}
    </Button>
  );
}
