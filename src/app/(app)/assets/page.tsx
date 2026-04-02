'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Upload, FolderOpen, File, Trash2 } from 'lucide-react';
import supabase from '@/lib/supabase';
import { useLang } from '@/lib/lang-context';
import EmptyState from '@/components/ui/EmptyState';
import type { Asset } from '@/lib/types';

export default function AssetsPage() {
  const { t } = useLang();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) {
        if (process.env.NODE_ENV === 'development') console.error('[assets fetch]', error);
        setAssets([]);
      } else {
        setAssets((data ?? []) as Asset[]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const filePath = `global/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('client-assets').getPublicUrl(filePath);
      const { error: dbError } = await supabase.from('assets').insert({
        name: file.name,
        file_path: filePath,
        file_url: urlData.publicUrl,
      });
      if (dbError) throw dbError;

      await supabase.from('activities').insert({
        type: 'asset',
        description: `Asset "${file.name}" uploaded`,
      });
      fetchAssets();
    } catch (err: unknown) {
      if (process.env.NODE_ENV === 'development') console.error('[asset upload]', err);
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (asset: Asset) => {
    if (!confirm('Delete this asset?')) return;
    await supabase.storage.from('client-assets').remove([asset.file_path]);
    const { error } = await supabase.from('assets').delete().eq('id', asset.id);
    if (error) {
      if (process.env.NODE_ENV === 'development') console.error('[asset delete]', error);
      return;
    }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('assets')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage uploaded files</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-60 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Upload size={16} />{uploading ? t('loading') : t('uploadFile')}
        </button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={t('noAssetsYet')}
          description={t('noAssetsDesc')}
          action={
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}
            >
              <Upload size={16} />{t('uploadFile')}
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map(asset => {
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(asset.name);
            return (
              <div
                key={asset.id}
                className="group relative rounded-2xl border overflow-hidden"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                {isImage ? (
                  <div className="aspect-square overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                    <File size={32} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>{asset.name}</p>
                </div>
                <button
                  onClick={() => handleDelete(asset)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
