import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

interface InfoCalloutProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  heading: ReactNode;
  body?: ReactNode;
}

export default function InfoCallout({ icon, heading, body, className, children, ...props }: InfoCalloutProps) {
  return (
    <div
      className={clsx(
        'rounded-2xl border border-black/[0.04] bg-slate-50 p-4 dark:border-white/[0.05] dark:bg-white/[0.03]',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon ? <span className="text-slate-500 dark:text-slate-300">{icon}</span> : null}
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</h3>
      </div>
      {body ? <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{body}</p> : null}
      {children}
    </div>
  );
}
