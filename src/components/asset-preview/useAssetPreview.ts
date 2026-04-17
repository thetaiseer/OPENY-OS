'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AssetPreviewInfo, AssetPreviewInput } from '@/lib/asset-preview';
import { getAssetPreviewInfo } from '@/lib/asset-preview';

export interface UseAssetPreviewResult {
  info: AssetPreviewInfo;
  currentUrl: string | null;
  fallbackCount: number;
  exhausted: boolean;
  tryingNext: boolean;
  moveToNextUrl: () => void;
  reset: () => void;
}

export function useAssetPreview(asset: AssetPreviewInput | null): UseAssetPreviewResult | null {
  const info = useMemo(() => {
    if (!asset) return null;
    return getAssetPreviewInfo(asset);
  }, [asset]);

  const [index, setIndex] = useState(0);
  const [tryingNext, setTryingNext] = useState(false);

  useEffect(() => {
    setIndex(0);
    setTryingNext(false);
  }, [info?.id, info?.displayTitle, info?.previewUrl, info?.openUrl, info?.downloadUrl]);

  const moveToNextUrl = useCallback(() => {
    if (!info) return;
    setTryingNext(true);
    setIndex((prev) => {
      const next = Math.min(prev + 1, Math.max(info.urlCandidates.length - 1, 0));
      return next;
    });
    setTimeout(() => setTryingNext(false), 120);
  }, [info]);

  const reset = useCallback(() => {
    setIndex(0);
    setTryingNext(false);
  }, []);

  if (!info) return null;

  const currentUrl = info.urlCandidates[index] ?? null;
  const exhausted = !currentUrl;

  return {
    info,
    currentUrl,
    fallbackCount: index,
    exhausted,
    tryingNext,
    moveToNextUrl,
    reset,
  };
}
