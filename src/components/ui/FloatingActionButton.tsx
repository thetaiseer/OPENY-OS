'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/cn';

type FloatingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
};

export default function FloatingActionButton({
  icon = <Plus className="h-5 w-5" />,
  className,
  ...props
}: FloatingActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'fixed bottom-16 right-4 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] text-white shadow-soft-md transition-transform hover:scale-[1.03] active:scale-[0.97] md:hidden',
        className,
      )}
    >
      {icon}
    </button>
  );
}
