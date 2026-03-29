"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Asset, AssetType } from "./types";
import {
  subscribeToAssets,
  createAsset as fsCreateAsset,
  updateAsset as fsUpdateAsset,
  deleteAsset as fsDeleteAsset,
} from "./firestore/assets";

export type CreateAssetData = {
  clientId: string;
  name: string;
  type: AssetType;
  fileUrl: string;
  thumbnailUrl?: string;
  fileSize?: number;
  format?: string;
  tags?: string[];
  folder?: string;
  uploadedBy?: string;
};

interface AssetsContextValue {
  assets: Asset[];
  loading: boolean;
  createAsset: (data: CreateAssetData) => Promise<string>;
  updateAsset: (id: string, data: Partial<Omit<Asset, "id" | "createdAt">>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
}

const AssetsContext = createContext<AssetsContextValue | null>(null);

export function AssetsProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAssets(
      (rows) => { setAssets(rows); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const createAsset = useCallback(async (data: CreateAssetData): Promise<string> => {
    return fsCreateAsset(data);
  }, []);

  const updateAsset = useCallback(
    async (id: string, data: Partial<Omit<Asset, "id" | "createdAt">>) => {
      await fsUpdateAsset(id, data);
    },
    [],
  );

  const deleteAsset = useCallback(async (id: string) => {
    await fsDeleteAsset(id);
  }, []);

  const value: AssetsContextValue = useMemo(
    () => ({ assets, loading, createAsset, updateAsset, deleteAsset }),
    [assets, loading, createAsset, updateAsset, deleteAsset],
  );

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export function useAssets(clientId?: string): AssetsContextValue & { filtered: Asset[] } {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used inside <AssetsProvider>");
  const filtered = clientId ? ctx.assets.filter((a) => a.clientId === clientId) : ctx.assets;
  return { ...ctx, filtered };
}
