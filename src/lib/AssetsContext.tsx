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
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "./firebase";
import type { Asset, AssetType } from "./types";

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
    const unsub = onSnapshot(
      query(wsCol("assets"), orderBy("createdAt", "desc")),
      (snap) => {
        setAssets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset)));
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] Firestore listener error for assets:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const createAsset = useCallback(async (data: CreateAssetData): Promise<string> => {
    const now = new Date().toISOString();
    const docRef = await addDoc(wsCol("assets"), {
      clientId: data.clientId,
      name: data.name,
      type: data.type,
      fileUrl: data.fileUrl,
      thumbnailUrl: data.thumbnailUrl ?? "",
      fileSize: data.fileSize ?? 0,
      format: data.format ?? "",
      tags: data.tags ?? [],
      folder: data.folder ?? "",
      uploadedBy: data.uploadedBy ?? "",
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }, []);

  const updateAsset = useCallback(
    async (id: string, data: Partial<Omit<Asset, "id" | "createdAt">>) => {
      await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "assets", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const deleteAsset = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "assets", id));
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
