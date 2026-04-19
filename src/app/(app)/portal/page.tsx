'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Eye, Download } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { createClient } from '@/lib/supabase/client';
import AssetPreviewModal from '@/components/asset-preview/AssetPreviewModal';
import type { Asset } from '@/lib/types';
import { toPreviewInput } from '@/lib/asset-preview';

/**
 * Client read-only portal — shows their own assets.
 * Accessible by the 'client' role only (enforced via middleware).
 */
export default function PortalPage() {
  const { user, clientId } = useAuth();
  const [previewAsset, setPreviewAsset] = useState<Asset | null>(null);

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

  const { data: assets, isLoading } = useQuery<Asset[]>({
    queryKey: ['portal-assets', user.id, clientId],
    enabled: !!user.id,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from('assets')
        .select('id, name, content_type, file_url, file_path, storage_path, storage_key, view_url, web_view_link, download_url, preview_url, file_type, mime_type, file_size, client_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (clientId) q = q.eq('client_id', clientId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as Asset[];
    },
    staleTime: 30_000,
  });

  const total = assets?.length ?? 0;

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Welcome, {user.name} 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Your client portal — view your assets
        </p>
      </div>

      {/* Summary card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border p-5 flex items-center gap-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <FolderOpen size={18} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{total}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Assets</p>
          </div>
        </div>
      </div>

      {/* Asset list */}
      <div>
        <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text)' }}>Your Assets</h2>
        {isLoading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : !assets?.length ? (
          <div className="rounded-2xl border p-12 text-center" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <FolderOpen size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-base font-medium" style={{ color: 'var(--text)' }}>No assets yet</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Your team will upload assets here</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            {assets.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-4 border-b last:border-b-0" style={{ borderColor: 'var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-2)' }}>
                  <FolderOpen size={16} style={{ color: 'var(--accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{a.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {a.content_type} · {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {(a.web_view_link ?? a.view_url ?? a.file_url) && (
                    <button
                      onClick={() => { void handleViewAsset(a); }}
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-70 transition-opacity"
                      style={{ background: 'var(--surface-2)' }}
                      title="View"
                    >
                      <Eye size={14} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  )}
                  {a.download_url && (
                    <a href={a.download_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-8 h-8 rounded-lg hover:opacity-70 transition-opacity" style={{ background: 'var(--surface-2)' }} title="Download">
                      <Download size={14} style={{ color: 'var(--text-secondary)' }} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {previewAsset && (
        <AssetPreviewModal asset={toPreviewInput(previewAsset)} onClose={() => setPreviewAsset(null)} />
      )}
    </>
  );
}
