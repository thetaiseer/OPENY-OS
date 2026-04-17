'use client';

import AssetPreviewModal from '@/components/asset-preview/AssetPreviewModal';
import type { AssetPreviewInput } from '@/lib/asset-preview';

export interface PreviewFile {
  id?: string | null;
  name: string;
  url: string;
  storagePath?: string | null;
  filePath?: string | null;
  clientId?: string | null;
  downloadUrl?: string | null;
  openUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

interface FilePreviewModalProps {
  file: PreviewFile | null;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const mapped: AssetPreviewInput | null = file
    ? {
        id: file.id ?? null,
        name: file.name,
        file_name: file.name,
        file_url: file.url,
        download_url: file.downloadUrl ?? file.url,
        web_view_link: file.openUrl ?? null,
        view_url: file.openUrl ?? null,
        mime_type: file.mimeType ?? null,
        file_size: file.size ?? null,
        storage_path: file.storagePath ?? null,
        file_path: file.filePath ?? null,
        storage_bucket: 'openy-assets',
      }
    : null;

  return <AssetPreviewModal asset={mapped} onClose={onClose} />;
}
