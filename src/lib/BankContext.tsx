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
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { BankEntry, BankCategory, ContentPlatform } from "./types";

export type CreateBankEntryData = {
  clientId: string;
  category: BankCategory;
  text: string;
  tags?: string[];
  platform?: ContentPlatform;
};

interface BankContextValue {
  entries: BankEntry[];
  loading: boolean;
  createEntry: (data: CreateBankEntryData) => Promise<string>;
  deleteEntry: (id: string) => Promise<void>;
}

const BankContext = createContext<BankContextValue | null>(null);

export function BankProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<BankEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "bankEntries"), orderBy("createdAt", "desc")),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankEntry)));
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] Firestore listener error for bankEntries:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const createEntry = useCallback(async (data: CreateBankEntryData): Promise<string> => {
    const docRef = await addDoc(collection(db, "bankEntries"), {
      clientId: data.clientId,
      category: data.category,
      text: data.text,
      tags: data.tags ?? [],
      platform: data.platform ?? null,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "bankEntries", id));
  }, []);

  const value: BankContextValue = useMemo(
    () => ({ entries, loading, createEntry, deleteEntry }),
    [entries, loading, createEntry, deleteEntry],
  );

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank(clientId?: string, category?: BankCategory): BankContextValue & { filtered: BankEntry[] } {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  let filtered = ctx.entries;
  if (clientId) filtered = filtered.filter((e) => e.clientId === clientId);
  if (category) filtered = filtered.filter((e) => e.category === category);
  return { ...ctx, filtered };
}
