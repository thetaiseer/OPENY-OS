'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppPeriod } from '@/context/app-period-context';
import { Upload, Download } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/context/lang-context';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { useUpload, type InitialUploadItem } from '@/context/upload-context';
import UploadModal, { type UploadFileItem } from '@/components/features/upload/UploadModal';
import FilePreviewModal from '@/components/ui/FilePreviewModal';
import { AssetsGrid, isPdf as isPdfFile } from '@/components/ui/AssetsGrid';
import { generateVideoThumbnail, isVideoFile } from '@/lib/video-thumbnail';
import { generatePdfPreview } from '@/lib/pdf-preview';
import { useClientWorkspace } from '../client-context';
import type { Asset } from '@/lib/types';
import ConfirmDialog from '@/components/ui/actions/ConfirmDialog';

export default function ClientAssetsPage() {
  const { client, clientId } = useClientWorkspace();
  const { t } = useLang();
  const { user } = useAuth();
  const { toast: addToast } = useToast();
  const { startBatch, latestAsset } = useUpload();
  const { periodYm } = useAppPeriod();

  const fileRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);
  const [pendingDeleteAsset, setPendingDeleteAsset] = useState<Asset | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);

  const [pendingItems, setPendingItems] = useState<UploadFileItem[]>([]);
  const [uploadMainCategory, setUploadMainCategory] = useState('social-media');
  const [uploadSubCategory, setUploadSubCategory] = useState('');
  const [uploadMonthKey, setUploadMonthKey] = useState(periodYm);

  useEffect(() => {
    setUploadMonthKey(periodYm);
  }, [periodYm]);

  const load = useCallback(async () => {
    if (!clientId) {
      setAssets([]);
      setLoading(false);
      return;
    }
    // List every asset for this client (all months). Filtering by workspace
    // `periodYm` hid uploads when the modal month or legacy `month_key` differed.
    let { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('client_id', clientId)
      .neq('is_deleted', true)
      .is('deleted_at', null)
      .neq('missing_in_storage', true)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error?.code === '42703') {
      // Older schema — drop soft-delete filters that may not exist yet.
      const retry = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId)
        .neq('is_deleted', true)
        .order('created_at', { ascending: false })
        .limit(200);
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      console.error('[client assets] load failed:', error);
      addToast(error.message, 'error');
      setAssets([]);
    } else {
      setAssets((data ?? []) as Asset[]);
    }
    setLoading(false);
  }, [clientId, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Prepend newly uploaded assets as soon as the upload queue reports completion.
  useEffect(() => {
    if (!latestAsset || !clientId) return;
    const sameClientById =
      latestAsset.client_id != null && String(latestAsset.client_id) === String(clientId);
    const sameClientByName =
      Boolean(client?.name) &&
      Boolean(latestAsset.client_name) &&
      String(latestAsset.client_name).trim() === String(client?.name ?? '').trim();
    if (!sameClientById && !sameClientByName) return;
    setAssets((prev) => {
      if (prev.some((a) => a.id === latestAsset.id)) return prev;
      return [latestAsset, ...prev];
    });
  }, [latestAsset, clientId, client?.name]);

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;
    const items: UploadFileItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: /^image\//.test(file.type) ? URL.createObjectURL(file) : null,
      uploadName: file.name.replace(/\.[^.]+$/, ''),
      thumbnailBlob: null,
      durationSeconds: null,
      previewBlob: null,
    }));
    setPendingItems(items);
    setUploadMainCategory('social-media');
    setUploadSubCategory('');
    setUploadMonthKey(periodYm);

    items.forEach((item) => {
      if (!isVideoFile(item.file.name, item.file.type)) return;
      void generateVideoThumbnail(item.file).then((result) => {
        if (!result) return;
        setPendingItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  previewUrl: result.blobUrl,
                  thumbnailBlob: result.blob,
                  durationSeconds: result.durationSeconds,
                }
              : i,
          ),
        );
      });
    });

    items.forEach((item) => {
      if (!isPdfFile(item.file.name, item.file.type)) return;
      void generatePdfPreview(item.file).then((result) => {
        if (!result) return;
        setPendingItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, previewUrl: result.blobUrl, previewBlob: result.blob } : i,
          ),
        );
      });
    });
  };

  const handleUploadConfirm = () => {
    if (!pendingItems.length || !client) return;
    const initialItems: InitialUploadItem[] = pendingItems.map((i) => ({
      id: i.id,
      file: i.file,
      previewUrl: i.previewUrl,
      uploadName: i.uploadName,
      thumbnailBlob: i.thumbnailBlob,
      durationSeconds: i.durationSeconds,
      previewBlob: i.previewBlob,
    }));
    startBatch(initialItems, {
      clientName: client.name,
      clientId,
      contentType: '',
      mainCategory: uploadMainCategory,
      subCategory: uploadSubCategory,
      monthKey: uploadMonthKey,
      uploadedBy: user?.name ?? user?.email ?? null,
      uploadedByEmail: user?.email ?? null,
    });
    setPendingItems([]);
    addToast(
      `${initialItems.length} file${initialItems.length !== 1 ? 's' : ''} queued for upload`,
      'success',
    );
  };

  const handleDownloadZip = async () => {
    if (!client) return;
    setDownloadingZip(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/download-zip`);
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = json.error ?? `Download failed (HTTP ${res.status})`;
        addToast(
          res.status === 404 && msg.includes('No R2-hosted assets')
            ? 'No downloadable files found for this client'
            : msg,
          'error',
        );
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.name.replace(/[^a-z0-9_\- ]/gi, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      addToast('Download ready', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Download failed', 'error');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleDeleteAsset = async (asset: Asset) => {
    setDeletingAssetId(asset.id);
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error');
        return;
      }
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      addToast('Asset deleted', 'success');
    } finally {
      setDeletingAssetId((current) => (current === asset.id ? null : current));
    }
  };

  const handleCopyAssetLink = async (asset: Asset) => {
    try {
      await navigator.clipboard.writeText(asset.view_url ?? asset.file_url);
      addToast('Link copied', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <div
            className="h-9 w-40 animate-pulse rounded-lg"
            style={{ background: 'var(--surface-2)' }}
          />
          <div
            className="h-9 w-32 animate-pulse rounded-lg"
            style={{ background: 'var(--surface-2)' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-xl"
              style={{ background: 'var(--surface)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <button
          onClick={() => void handleDownloadZip()}
          disabled={downloadingZip || assets.length === 0}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
          }}
        >
          <Download size={14} />
          {downloadingZip ? 'Preparing download…' : 'Download Client Folder'}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--accent)' }}
        >
          <Upload size={14} />
          {t('uploadFile')}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          aria-label="Upload files"
          className="hidden"
          onChange={handleFileChosen}
        />
      </div>

      {assets.length === 0 ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('noAssetsYet')}
        </div>
      ) : (
        <AssetsGrid
          assets={assets}
          canDelete={user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager'}
          onView={(asset) => setPreviewAsset(asset)}
          onDelete={(asset) => setPendingDeleteAsset(asset)}
          onCopyLink={(asset) => void handleCopyAssetLink(asset)}
          singleClientLogoUrl={client?.logo ?? null}
        />
      )}

      {/* Asset preview modal */}
      {previewAsset && (
        <FilePreviewModal
          file={{
            name: previewAsset.name,
            url: previewAsset.preview_url || previewAsset.file_url,
            downloadUrl: previewAsset.download_url ?? previewAsset.file_url,
            openUrl: previewAsset.web_view_link || previewAsset.view_url || null,
            mimeType: previewAsset.file_type ?? previewAsset.mime_type ?? null,
            size: previewAsset.file_size ?? null,
          }}
          onClose={() => setPreviewAsset(null)}
        />
      )}

      {/* Upload modal */}
      {pendingItems.length > 0 && client && (
        <UploadModal
          files={pendingItems}
          mainCategory={uploadMainCategory}
          subCategory={uploadSubCategory}
          monthKey={uploadMonthKey}
          clientName={client.name}
          clientId={clientId}
          clients={[]}
          lockClient
          onMainCategoryChange={setUploadMainCategory}
          onSubCategoryChange={setUploadSubCategory}
          onMonthChange={setUploadMonthKey}
          onUploadNameChange={(itemId, name) =>
            setPendingItems((prev) =>
              prev.map((i) => (i.id === itemId ? { ...i, uploadName: name } : i)),
            )
          }
          onRemoveFile={(itemId) => {
            const removed = pendingItems.find((i) => i.id === itemId);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            setPendingItems((prev) => prev.filter((i) => i.id !== itemId));
          }}
          onConfirm={handleUploadConfirm}
          onCancel={() => {
            pendingItems.forEach((i) => {
              if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
            });
            setPendingItems([]);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteAsset)}
        title={t('deleteAction')}
        description={
          pendingDeleteAsset ? `Delete "${pendingDeleteAsset.name}"?` : t('deleteAction')
        }
        confirmLabel={t('deleteAction')}
        cancelLabel={t('cancel')}
        destructive
        loading={Boolean(pendingDeleteAsset) && deletingAssetId === pendingDeleteAsset?.id}
        onCancel={() => setPendingDeleteAsset(null)}
        onConfirm={async () => {
          if (!pendingDeleteAsset) return;
          await handleDeleteAsset(pendingDeleteAsset);
          setPendingDeleteAsset(null);
        }}
      />
    </div>
  );
}
