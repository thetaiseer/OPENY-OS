'use client';

import type { ReactNode } from 'react';

export function isImage(..._args: any[]) {
  return false;
}

export function isVideo(..._args: any[]) {
  return false;
}

export function isPdf(..._args: any[]) {
  return false;
}

type AssetsGridProps = {
  children?: ReactNode;
  onDelete?: (asset: any) => void;
  onCopyLink?: (asset: any) => void;
  onComments?: (asset: any) => void;
  onRename?: (asset: any, name: any) => void;
  onSchedule?: (asset: any) => void;
  onView?: (asset: any) => void;
  [key: string]: any;
};

export function AssetsGrid({ children }: AssetsGridProps) {
  return <div>{children}</div>;
}
