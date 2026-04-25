'use client';

import type { ReactNode } from 'react';
import { Eye, Link2, MessageSquare, CalendarDays, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';

export function isImage(asset: unknown, fallbackType?: unknown, ..._rest: unknown[]) {
  const maybeAsset = asset as { mime_type?: string | null; file_type?: string | null } | string;
  const type =
    typeof maybeAsset === 'string'
      ? maybeAsset
      : (maybeAsset?.mime_type ?? maybeAsset?.file_type ?? String(fallbackType ?? ''));
  return type.startsWith('image/');
}

export function isVideo(asset: unknown, fallbackType?: unknown, ..._rest: unknown[]) {
  const maybeAsset = asset as { mime_type?: string | null; file_type?: string | null } | string;
  const type =
    typeof maybeAsset === 'string'
      ? maybeAsset
      : (maybeAsset?.mime_type ?? maybeAsset?.file_type ?? String(fallbackType ?? ''));
  return type.startsWith('video/');
}

export function isPdf(asset: unknown, fallbackType?: unknown, ..._rest: unknown[]) {
  const maybeAsset = asset as { mime_type?: string | null; file_type?: string | null } | string;
  const baseType =
    typeof maybeAsset === 'string'
      ? maybeAsset
      : (maybeAsset?.mime_type ?? maybeAsset?.file_type ?? String(fallbackType ?? ''));
  const type = baseType.toLowerCase();
  return type.includes('pdf');
}

type AssetsGridProps = {
  children?: ReactNode;
  assets?: Array<any>;
  className?: string;
  onDelete?: (asset: any) => void;
  onCopyLink?: (asset: any) => void;
  onComments?: (asset: any) => void;
  onRename?: (asset: any, name: string) => void;
  onSchedule?: (asset: any) => void;
  onView?: (asset: any) => void;
  [key: string]: unknown;
};

export function AssetsGrid({
  children,
  assets = [],
  className,
  onDelete,
  onCopyLink,
  onComments,
  onSchedule,
  onView,
}: AssetsGridProps) {
  if (!assets.length)
    return (
      <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>{children}</div>
    );

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3', className)}>
      {assets.map((asset) => (
        <article
          key={asset.id ?? asset.name}
          className="rounded-card border border-border bg-surface p-4 shadow-soft"
        >
          <h4 className="truncate text-sm font-medium text-primary">
            {asset.name ?? 'Untitled asset'}
          </h4>
          <p className="mt-1 text-xs text-secondary">
            {asset.created_at ? new Date(asset.created_at).toLocaleDateString() : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onView?.(asset)}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onCopyLink?.(asset)}>
              <Link2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onComments?.(asset)}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onSchedule?.(asset)}>
              <CalendarDays className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDelete?.(asset)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </article>
      ))}
      {children}
    </div>
  );
}
