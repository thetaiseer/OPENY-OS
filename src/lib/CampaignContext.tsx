"use client";

// ============================================================
// OPENY OS – Campaign Store (Firestore Edition)
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
} from "firebase/firestore";
import { db } from "./firebase";
import type { Campaign, CampaignStatus, ContentPlatform } from "./types";

// ── Context shape ─────────────────────────────────────────────

export type CreateCampaignData = {
  clientId: string;
  name: string;
  objective?: string;
  description?: string;
  platforms?: ContentPlatform[];
  budget?: number;
  targetAudience?: string;
  startDate?: string;
  endDate?: string;
  status?: CampaignStatus;
  ownerId?: string;
  notes?: string;
};

interface CampaignContextValue {
  campaigns: Campaign[];
  loading: boolean;
  createCampaign: (data: CreateCampaignData) => Promise<string>;
  updateCampaign: (id: string, data: Partial<Omit<Campaign, "id" | "createdAt">>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "campaigns"), orderBy("createdAt", "desc")),
      (snap) => {
        setCampaigns(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Campaign)));
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] Firestore listener error for campaigns:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const createCampaign = useCallback(async (data: CreateCampaignData): Promise<string> => {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, "campaigns"), {
      clientId: data.clientId,
      name: data.name,
      objective: data.objective ?? "",
      description: data.description ?? "",
      platforms: data.platforms ?? [],
      budget: data.budget ?? 0,
      targetAudience: data.targetAudience ?? "",
      startDate: data.startDate ?? "",
      endDate: data.endDate ?? "",
      status: data.status ?? "draft",
      ownerId: data.ownerId ?? "",
      linkedContentCount: 0,
      linkedTaskCount: 0,
      notes: data.notes ?? "",
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }, []);

  const updateCampaign = useCallback(
    async (id: string, data: Partial<Omit<Campaign, "id" | "createdAt">>) => {
      await updateDoc(doc(db, "campaigns", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const deleteCampaign = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "campaigns", id));
  }, []);

  const value: CampaignContextValue = useMemo(
    () => ({ campaigns, loading, createCampaign, updateCampaign, deleteCampaign }),
    [campaigns, loading, createCampaign, updateCampaign, deleteCampaign],
  );

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaigns(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaigns must be used inside <CampaignProvider>");
  return ctx;
}
