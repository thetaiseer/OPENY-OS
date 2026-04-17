'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Upload, Download, Search, Sparkles } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { useUpload, type InitialUploadItem } from '@/lib/upload-context';
import UploadModal, { type UploadFileItem } from '@/components/upload/UploadModal';
import AssetPreviewModal from '@/components/asset-preview/AssetPreviewModal';
import { AssetsGrid, isPdf as isPdfFile } from '@/components/ui/AssetsGrid';
import EmptyState from '@/components/ui/EmptyState';
import { generateVideoThumbnail, isVideoFile } from '@/lib/video-thumbnail';
import { generatePdfPreview } from '@/lib/pdf-preview';
import { useClientWorkspace } from '../client-context';
import type { Asset } from '@/lib/types';
import { toPreviewInput } from '@/lib/asset-preview';

export default function ClientAssetsPage() {
  const { client, clientId } = useClientWorkspace();
  const { t } = useLang();
  const { user } = useAuth();
  const { toast: addToast } = useToast();
  const { startBatch, latestAsset } = useUpload();
  const searchParams = useSearchParams();

  const fileRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

  const [pendingItems, setPendingItems] = useState<UploadFileItem[]>([]);
  const [uploadMainCategory, setUploadMainCategory] = useState('social-media');
  const [uploadSubCategory, setUploadSubCategory] = useState('');
  const [uploadMonthKey, setUploadMonthKey] = useState(() => new Date().toISOString().slice(0, 7));

  const [search, setSearch] = useState('');
  const [showUploadHint, setShowUploadHint] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    const { data } = await supabase
      .from('assets')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(100);
    setAssets((data ?? []) as Asset[]);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!latestAsset) return;
    if (!clientId || latestAsset.client_id !== clientId) return;
    setAssets(prev => {
      if (prev.some(asset => asset.id === latestAsset.id)) return prev;
      return [latestAsset, ...prev];
    });
  }, [latestAsset, clientId]);

  useEffect(() => {
    if (searchParams.get('quickAction') === 'upload') {
      setShowUploadHint(true);
      const timer = setTimeout(() => setShowUploadHint(false), 4500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(asset => asset.name.toLowerCase().includes(q) || asset.file_type?.toLowerCase().includes(q));
  }, [assets, search]);

  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (!files.length) return;

    const items: UploadFileItem[] = files.map(file => ({
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
    setUploadMonthKey(new Date().toISOString().slice(0, 7));

    items.forEach(item => {
      if (!isVideoFile(item.file.name, item.file.type)) return;
      void generateVideoThumbnail(item.file).then(result => {
        if (!result) return;
        setPendingItems(prev => prev.map(row => (
          row.id === item.id
            ? { ...row, previewUrl: result.blobUrl, thumbnailBlob: result.blob, durationSeconds: result.durationSeconds }
            : row
        )));
      });
    });

    items.forEach(item => {
      if (!isPdfFile(item.file.name, item.file.type)) return;
      void generatePdfPreview(item.file).then(result => {
        if (!result) return;
        setPendingItems(prev => prev.map(row => (
          row.id === item.id ? { ...row, previewUrl: result.blobUrl, previewBlob: result.blob } : row
        )));
      });
    });
  };

  const handleUploadConfirm = () => {
    if (!pendingItems.length || !client) return;

    const initialItems: InitialUploadItem[] = pendingItems.map(item => ({
      id: item.id,
      file: item.file,
      previewUrl: item.previewUrl,
      uploadName: item.uploadName,
      thumbnailBlob: item.thumbnailBlob,
      durationSeconds: item.durationSeconds,
      previewBlob: item.previewBlob,
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
    addToast(`${initialItems.length} file${initialItems.length !== 1 ? 's' : ''} queued for upload`, 'success');
  };

  const handleDownloadZip = async () => {
    if (!client) return;
    setDownloadingZip(true);

    try {
      const res = await fetch(`/api/clients/${clientId}/download-zip`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        const message = json.error ?? `Download failed (HTTP ${res.status})`;
        addToast(res.status === 404 && message.includes('No R2-hosted assets') ? 'No downloadable files found for this client' : message, 'error');
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
    if (!confirm(`Delete "${asset.name}"?`)) return;
    const res = await fetch(`/api/assets/${asset.id}`, { method: 'DELETE' });
    const json = await res.json() as { error?: string };

    if (!res.ok) {
      addToast(`Delete failed: ${json.error ?? `HTTP ${res.status}`}`, 'error');
      return;
    }

    setAssets(prev => prev.filter(row => row.id !== asset.id));
    addToast('File deleted', 'success');

    await supabase.from('activities').insert({
      type: 'delete',
      description: `Asset "${asset.name}" deleted`,
      client_id: clientId,
    });
  };

  const handleCopyAssetLink = async (asset: Asset) => {
    try {
      await navigator.clipboard.writeText(asset.view_url ?? asset.file_url);
      addToast('Link copied', 'success');
    } catch {
      addToast('Failed to copy link', 'error');
    }
  };

  const handleViewAsset = async (asset: Asset) => {
    try {
      const res = await fetch(`/api/assets/${asset.id}`);
      if (!res.ok) {
        setPreviewAsset(asset);
        return;
      }
      const json = await res.json() as { asset?: Asset };
      setPreviewAsset(json.asset ?? asset);
    } catch {
      setPreviewAsset(asset);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <div className="h-9 w-40 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
          <div className="h-9 w-32 rounded-lg animate-pulse" style={{ background: 'var(--surface-2)' }} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-glass h-9 w-full pl-8 pr-3 text-sm"
              placeholder="Search asset name or file type"
            />
          </div>

          <button
            onClick={() => void handleDownloadZip()}
            disabled={downloadingZip || assets.length === 0}
            className="btn-secondary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={14} />
            {downloadingZip ? 'Preparing download…' : 'Download Folder'}
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className={`h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 text-white transition-all ${showUploadHint ? 'animate-openy-scale-in' : ''}`}
            style={{ background: showUploadHint ? 'linear-gradient(135deg, #14b8a6 0%, #0ea5e9 100%)' : 'var(--accent)' }}
          >
            {showUploadHint ? <Sparkles size={14} /> : <Upload size={14} />}
            {showUploadHint ? 'Upload Assets' : t('uploadFile')}
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
      </div>

      {filteredAssets.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={Upload}
            title="No assets yet"
            description="Upload campaign files, references, and deliverables for this client workspace."
            action={(
              <button onClick={() => fileRef.current?.click()} className="btn-primary h-9 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2">
                <Upload size={14} /> Upload asset
              </button>
            )}
          />
        </div>
      ) : (
        <AssetsGrid
          assets={filteredAssets}
          canDelete={user?.role === 'admin' || user?.role === 'owner'}
          onView={asset => { void handleViewAsset(asset); }}
          onDelete={asset => void handleDeleteAsset(asset)}
          onCopyLink={asset => void handleCopyAssetLink(asset)}
        />
      )}

      {previewAsset && (
        <AssetPreviewModal asset={toPreviewInput(previewAsset)} onClose={() => setPreviewAsset(null)} />
      )}

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
            setPendingItems(prev => prev.map(item => (item.id === itemId ? { ...item, uploadName: name } : item)))
          }
          onRemoveFile={itemId => {
            const removed = pendingItems.find(item => item.id === itemId);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            setPendingItems(prev => prev.filter(item => item.id !== itemId));
          }}
          onConfirm={handleUploadConfirm}
          onCancel={() => {
            pendingItems.forEach(item => {
              if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
            });
            setPendingItems([]);
          }}
        />
      )}
    </div>
  );
}
