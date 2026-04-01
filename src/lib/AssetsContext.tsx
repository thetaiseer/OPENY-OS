"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect } from

"react";

import {
  subscribeToAssets,
  createAsset as fsCreateAsset,
  updateAsset as fsUpdateAsset,
  deleteAsset as fsDeleteAsset } from
"./supabase/assets";
import { withTimeout } from "./utils/crud";






















const AssetsContext = createContext(null);

export function AssetsProvider({ children }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToAssets(
      (rows) => {setAssets(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const createAsset = useCallback(async (data) => {
    return withTimeout(fsCreateAsset(data));
  }, []);

  const updateAsset = useCallback(
    async (id, data) => {
      await withTimeout(fsUpdateAsset(id, data));
    },
    []
  );

  const deleteAsset = useCallback(async (id) => {
    await withTimeout(fsDeleteAsset(id));
  }, []);

  const value = useMemo(
    () => ({ assets, loading, createAsset, updateAsset, deleteAsset }),
    [assets, loading, createAsset, updateAsset, deleteAsset]
  );

  return <AssetsContext.Provider value={value}>{children}</AssetsContext.Provider>;
}

export function useAssets(clientId?) {
  const ctx = useContext(AssetsContext);
  if (!ctx) throw new Error("useAssets must be used inside <AssetsProvider>");
  const filtered = clientId ? ctx.assets.filter((a) => a.clientId === clientId) : ctx.assets;
  return { ...ctx, filtered };
}