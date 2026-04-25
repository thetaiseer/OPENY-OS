'use client';

import type { HTMLAttributes } from 'react';

export default function Skeleton(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} />;
}

export function SkeletonTable(
  props: HTMLAttributes<HTMLDivElement> & { rows?: number; cols?: number },
) {
  return <div {...props} />;
}

export function SkeletonStatGrid(props: HTMLAttributes<HTMLDivElement> & { count?: number }) {
  return <div {...props} />;
}
