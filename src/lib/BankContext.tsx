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
import type { BankEntry, BankCategory, ContentPlatform } from "./types";
import {
  subscribeToBankEntries,
  createBankEntry as fsCreateBankEntry,
  deleteBankEntry as fsDeleteBankEntry,
} from "./firestore/bankEntries";
import { withTimeout } from "./utils/crud";

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
    const unsub = subscribeToBankEntries(
      (rows) => { setEntries(rows); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const createEntry = useCallback(async (data: CreateBankEntryData): Promise<string> => {
    return withTimeout(fsCreateBankEntry(data));
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    await withTimeout(fsDeleteBankEntry(id));
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
