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

    // Sanitize file name: remove Arabic characters, spaces, and special symbols
    const safeFileName = file.name
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, '')   // Arabic
      .replace(/\s+/g, '-')                                           // spaces → dash
      .replace(/[^a-zA-Z0-9._-]/g, '')                               // keep only safe chars
      || `file-${Date.now()}`;

    const bucket = 'client-assets';
    const filePath = `global/${Date.now()}-${safeFileName}`;

    console.log('[asset upload] Step 0 – file info', {
      originalName: file.name,
      safeFileName,
      type: file.type,
      size: file.size,
      bucket,
      filePath,
    });

    try {
      // ── Step A: Upload file to Supabase Storage ──────────────────────────
      console.log('[asset upload] Step A – uploading to storage…');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: false });

      console.log('[asset upload] Step A – result', { uploadData, uploadError });
      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message} (${JSON.stringify(uploadError)})`);
      }

      // ── Step B: Get public URL ────────────────────────────────────────────
      console.log('[asset upload] Step B – getting public URL…');
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      console.log('[asset upload] Step B – result', { urlData });

      const publicUrl = urlData?.publicUrl ?? '';

      // ── Step C: Insert record into assets table ───────────────────────────
      console.log('[asset upload] Step C – inserting into assets table…');
      const { data: insertData, error: dbError } = await supabase.from('assets').insert({
        name: file.name,
        file_path: filePath,
        file_url: publicUrl,
        file_type: file.type || null,
        file_size: file.size || null,
        bucket_name: bucket,
      }).select().single();

      console.log('[asset upload] Step C – result', { insertData, dbError });
      if (dbError) {
        throw new Error(`DB insert failed: ${dbError.message} (code: ${dbError.code}, details: ${dbError.details})`);
      }

      // ── Activity log (non-blocking) ───────────────────────────────────────
      await supabase.from('activities').insert({
        type: 'asset',
        description: `Asset "${file.name}" uploaded`,
      });

      console.log('[asset upload] ✅ Upload complete');
      fetchAssets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[asset upload] ❌ FAILED:', msg, err);
      alert(`Upload failed:\n\n${msg}`);
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
