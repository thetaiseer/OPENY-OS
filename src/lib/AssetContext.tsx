"use client";

// ============================================================
// OPENY OS – Assets Library Store (Firestore Edition)
// ============================================================
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
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Asset, AssetType } from "./types";

// ── Context shape ─────────────────────────────────────────────

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

interface AssetContextValue {
  assets: Asset[];
  loading: boolean;
  createAsset: (data: CreateAssetData) => Promise<string>;
  updateAsset: (id: string, data: Partial<Omit<Asset, "id" | "createdAt">>) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  getClientAssets: (clientId: string) => Asset[];
}

const AssetContext = createContext<AssetContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function AssetProvider({ children }: { children: ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "assets"), orderBy("createdAt", "desc")),
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
    const docRef = await addDoc(collection(db, "assets"), {
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
      await updateDoc(doc(db, "assets", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const deleteAsset = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "assets", id));
  }, []);

  const getClientAssets = useCallback(
    (clientId: string) => assets.filter((a) => a.clientId === clientId),
    [assets],
  );

  const value: AssetContextValue = useMemo(
    () => ({ assets, loading, createAsset, updateAsset, deleteAsset, getClientAssets }),
    [assets, loading, createAsset, updateAsset, deleteAsset, getClientAssets],
  );

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}

export function useAssets(): AssetContextValue {
  const ctx = useContext(AssetContext);
  if (!ctx) throw new Error("useAssets must be used inside <AssetProvider>");
  return ctx;
}
