import type { HTMLAttributes } from 'react';
import clsx from 'clsx';

interface GridProps extends HTMLAttributes<HTMLDivElement> {
  cols?: 1 | 2 | 3 | 4;
}

export default function Grid({ cols = 2, className, ...props }: GridProps) {
  return <div className={clsx('ds-grid', `ds-grid--${cols}`, className)} {...props} />;
}
