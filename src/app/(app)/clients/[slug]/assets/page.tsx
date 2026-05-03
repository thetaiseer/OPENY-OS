'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useAppPeriod } from '@/context/app-period-context';
import { Upload, Download, Folder, ChevronRight, Home } from 'lucide-react';
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
import { getSafeErrorMessage, logClientError, parseApiError } from '@/lib/errors/app-error';
import { mainCategoryLabel, subCategoryLabel } from '@/lib/asset-utils';

type ClientAssetFolderPath = {
  mainCategory?: string;
  subCategory?: string;
  year?: string;
  month?: string;
};

type ClientAssetFolderEntry = {
  key: string;
  label: string;
  count: number;
};

function getAssetYear(asset: Asset): string {
  if (asset.month_key && asset.month_key.length >= 4) return asset.month_key.slice(0, 4);
  if (asset.created_at) return new Date(asset.created_at).getFullYear().toString();
  return 'Unknown';
}

function monthLabel(monthKey: string, t: (key: string) => string): string {
  const mm = monthKey.includes('-') ? monthKey.split('-')[1] : monthKey;
  const index = Number.parseInt(mm, 10) - 1;
  if (Number.isNaN(index) || index < 0 || index > 11) return monthKey;
  const year = monthKey.includes('-') ? monthKey.split('-')[0] : '';
  const label = t(`calMonth${index}`);
  return year ? `${label} ${year}` : label;
}

function groupAssets(
  assets: Asset[],
  path: ClientAssetFolderPath,
  t: (key: string) => string,
): ClientAssetFolderEntry[] {
  const groups = new Map<string, ClientAssetFolderEntry>();

  for (const asset of assets) {
    let key = '';
    let label = '';

    if (!path.mainCategory) {
      key = asset.main_category ?? 'other';
      label = mainCategoryLabel(key);
    } else if (!path.subCategory) {
      key = asset.sub_category ?? 'general';
      label = subCategoryLabel(path.mainCategory, key);
    } else if (!path.year) {
      key = getAssetYear(asset);
      label = key;
    } else if (!path.month) {
      key = asset.month_key ?? '';
      label = key ? monthLabel(key, t) : 'Unknown';
    } else {
      continue;
    }

    if (!groups.has(key)) groups.set(key, { key, label, count: 0 });
    const current = groups.get(key);
    if (current) current.count += 1;
  }

  return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function filterAssetsByFolderPath(assets: Asset[], path: ClientAssetFolderPath): Asset[] {
  return assets.filter((asset) => {
    if (path.mainCategory && (asset.main_category ?? 'other') !== path.mainCategory) {
      return false;
    }
    if (path.subCategory && (asset.sub_category ?? 'general') !== path.subCategory) {
      return false;
    }
    if (path.year && getAssetYear(asset) !== path.year) return false;
    if (path.month && (asset.month_key ?? '') !== path.month) return false;
    return true;
  });
}

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
  const [folderPath, setFolderPath] = useState<ClientAssetFolderPath>({});

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
      .is('deleted_at', null)
      .neq('is_deleted', true)
      .or('sync_status.is.null,sync_status.neq.deleted')
      .or('missing_in_storage.is.null,missing_in_storage.eq.false')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error?.code === '42703') {
      const retry = await supabase
        .from('assets')
        .select('*')
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .neq('is_deleted', true)
        .or('sync_status.is.null,sync_status.neq.deleted')
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

  const visibleAssets = useMemo(
    () => filterAssetsByFolderPath(assets, folderPath),
    [assets, folderPath],
  );
  const folderEntries = useMemo(
    () => groupAssets(visibleAssets, folderPath, t),
    [visibleAssets, folderPath, t],
  );
  const showFiles = Boolean(
    folderPath.mainCategory && folderPath.subCategory && folderPath.year && folderPath.month,
  );

  const navigateFolder = (entry: ClientAssetFolderEntry) => {
    setFolderPath((current) => {
      if (!current.mainCategory) return { mainCategory: entry.key };
      if (!current.subCategory) return { ...current, subCategory: entry.key };
      if (!current.year) return { ...current, year: entry.key };
      if (!current.month) return { ...current, month: entry.key };
      return current;
    });
  };

  const breadcrumbItems = useMemo(() => {
    const items: { label: string; path: ClientAssetFolderPath }[] = [];
    if (folderPath.mainCategory) {
      items.push({
        label: mainCategoryLabel(folderPath.mainCategory),
        path: { mainCategory: folderPath.mainCategory },
      });
    }
    if (folderPath.mainCategory && folderPath.subCategory) {
      items.push({
        label: subCategoryLabel(folderPath.mainCategory, folderPath.subCategory),
        path: { mainCategory: folderPath.mainCategory, subCategory: folderPath.subCategory },
      });
    }
    if (folderPath.mainCategory && folderPath.subCategory && folderPath.year) {
      items.push({
        label: folderPath.year,
        path: {
          mainCategory: folderPath.mainCategory,
          subCategory: folderPath.subCategory,
          year: folderPath.year,
        },
      });
    }
    if (folderPath.mainCategory && folderPath.subCategory && folderPath.year && folderPath.month) {
      items.push({
        label: monthLabel(folderPath.month, t),
        path: folderPath,
      });
    }
    return items;
  }, [folderPath, t]);

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
    setUploadMainCategory(folderPath.mainCategory ?? 'social-media');
    setUploadSubCategory(folderPath.subCategory ?? '');
    setUploadMonthKey(folderPath.month ?? periodYm);

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
    console.log('[client-assets] delete clicked', { assetId: asset.id, assetName: asset.name });
    setDeletingAssetId(asset.id);
    try {
      console.log('[client-assets] calling delete API', { assetId: asset.id });
      const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
      const resForError = res.clone();
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      console.log('[client-assets] delete API response', {
        assetId: asset.id,
        status: res.status,
        ok: res.ok,
        body: json,
      });
      if (!res.ok) throw await parseApiError(resForError);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      await load();
      addToast('Asset deleted', 'success');
    } catch (error) {
      logClientError('[client-assets] delete failed', error);
      addToast(getSafeErrorMessage(error), 'error');
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
          className="flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium text-[var(--accent-foreground)] transition-opacity hover:opacity-90"
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

      {breadcrumbItems.length > 0 ? (
        <div
          className="flex flex-wrap items-center gap-1 rounded-xl border px-3 py-2"
          style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
        >
          <button
            type="button"
            onClick={() => setFolderPath({})}
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ background: 'var(--surface-2)' }}
          >
            <Home size={13} />
          </button>
          {breadcrumbItems.map((item, index) => (
            <span key={`${item.label}-${index}`} className="flex items-center gap-1">
              <ChevronRight size={13} className="opacity-50" />
              <button
                type="button"
                onClick={() => setFolderPath(item.path)}
                className="px-1 text-xs font-medium hover:underline"
                style={{
                  color: index === breadcrumbItems.length - 1 ? 'var(--text)' : 'var(--accent)',
                }}
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {assets.length === 0 ? (
        <div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>
          {t('noAssetsYet')}
        </div>
      ) : showFiles ? (
        <AssetsGrid
          assets={visibleAssets}
          canDelete={user?.role === 'admin' || user?.role === 'owner' || user?.role === 'manager'}
          onView={(asset) => setPreviewAsset(asset)}
          onDelete={(asset) => setPendingDeleteAsset(asset)}
          onCopyLink={(asset) => void handleCopyAssetLink(asset)}
          singleClientLogoUrl={client?.logo ?? null}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {folderEntries.map((folder) => (
            <button
              key={folder.key}
              type="button"
              onClick={() => navigateFolder(folder)}
              className="flex min-h-[11rem] flex-col items-center justify-center gap-3 rounded-2xl border p-5 text-center shadow-card transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text)',
              }}
            >
              <Folder className="h-10 w-10" style={{ color: 'var(--accent)' }} />
              <span className="max-w-full truncate text-base font-semibold">{folder.label}</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {folder.count} {folder.count === 1 ? 'file' : 'files'}
              </span>
            </button>
          ))}
        </div>
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
