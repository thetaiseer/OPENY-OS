'use client';

import type { ReactNode } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import AppModal from '@/components/ui/AppModal';
import Button from '@/components/ui/Button';

export default function FilePreviewModal({
  open = true,
  file,
  onClose,
  children,
}: {
  open?: boolean;
  file?: {
    name?: string;
    url?: string;
    downloadUrl?: string | null;
    openUrl?: string | null;
    mimeType?: string | null;
    size?: number | null;
  };
  onClose?: () => void;
  children?: ReactNode;
  [key: string]: unknown;
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title={file?.name ?? 'Preview'}
      subtitle={file?.mimeType ?? ''}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          {file?.openUrl ? (
            <a href={file.openUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </a>
          ) : null}
          {file?.downloadUrl ? (
            <a href={file.downloadUrl} target="_blank" rel="noreferrer">
              <Button variant="primary" size="sm">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </a>
          ) : null}
        </div>
      }
    >
      {file?.url ? (
        <iframe
          title={file?.name ?? 'file-preview'}
          src={file.url}
          className="h-[60vh] w-full rounded-control border border-border bg-surface"
        />
      ) : (
        <div className="rounded-control border border-border bg-surface p-4 text-sm text-secondary">
          Preview unavailable.
        </div>
      )}
      {children}
    </AppModal>
  );
}
