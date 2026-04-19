'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { AssetPreviewInput } from '@/lib/asset-preview';
import { AssetPreviewHeader } from './AssetPreviewHeader';
import { AssetImageViewer } from './AssetImageViewer';
import { AssetPdfViewer } from './AssetPdfViewer';
import { AssetVideoViewer } from './AssetVideoViewer';
import { AssetAudioPlayer } from './AssetAudioPlayer';
import { AssetTextViewer } from './AssetTextViewer';
import { AssetUnsupportedViewer } from './AssetUnsupportedViewer';
import { useAssetPreview } from './useAssetPreview';

export function AssetPreviewModal({ asset, onClose }: { asset: AssetPreviewInput | null; onClose: () => void }) {
  const state = useAssetPreview(asset);

  const onFailCurrentUrl = useCallback(() => {
    if (!state) return;
    console.warn('[AssetPreviewModal] preview URL failed', {
      file: state.info.displayTitle,
      fallbackCount: state.fallbackCount,
      url: state.currentUrl,
    });
    state.moveToNextUrl();
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEsc);
    };
  }, [state, onClose]);

  const viewer = useMemo(() => {
    if (!state) return null;
    const { info, currentUrl } = state;

    if (!currentUrl || state.exhausted || !info.isPreviewable) {
      return <AssetUnsupportedViewer info={info} />;
    }

    if (info.type === 'image') return <AssetImageViewer url={currentUrl} alt={info.displayTitle} onError={onFailCurrentUrl} />;
    if (info.type === 'pdf') return <AssetPdfViewer url={currentUrl} title={info.displayTitle} onError={onFailCurrentUrl} />;
    if (info.type === 'video') return <AssetVideoViewer url={currentUrl} mime={info.mime} onError={onFailCurrentUrl} />;
    if (info.type === 'audio') return <AssetAudioPlayer url={currentUrl} onError={onFailCurrentUrl} />;
    if (info.type === 'text') return <AssetTextViewer url={currentUrl} fileSize={info.fileSize} onError={onFailCurrentUrl} />;

    return <AssetUnsupportedViewer info={info} />;
  }, [state, onFailCurrentUrl]);

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[100] p-3 sm:p-5 flex items-center justify-center" style={{ background: 'rgba(6,8,14,0.82)' }} onClick={onClose}>
      <div
        className="w-full max-w-[1100px] max-h-[95vh] rounded-2xl overflow-hidden border flex flex-col"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'none' }}
        onClick={(e) => e.stopPropagation()}
      >
        <AssetPreviewHeader info={state.info} onClose={onClose} />

        <div className="flex-1 min-h-0 overflow-auto p-3 sm:p-5 flex items-center justify-center">
          {viewer}
        </div>

        {state.fallbackCount > 0 && (
          <div className="px-4 py-2 border-t border-amber-300/25 bg-amber-500/10 text-amber-100 text-xs flex items-center gap-2">
            <AlertTriangle size={14} />
            Switched to fallback preview source ({state.fallbackCount}).
          </div>
        )}
      </div>
    </div>
  );
}

export default AssetPreviewModal;
