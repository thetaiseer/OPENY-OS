'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AiImproveButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children?: ReactNode;
  value?: string;
  onImproved?: (value: string) => void;
  showMenu?: boolean;
  mode?: string;
};

export default function AiImproveButton({
  children,
  value,
  onImproved,
  ...props
}: AiImproveButtonProps) {
  return (
    <button
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (onImproved) onImproved(value ?? '');
      }}
    >
      {children}
    </button>
  );
}
