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
  subscribeToBankEntries,
  createBankEntry as fsCreateBankEntry,
  deleteBankEntry as fsDeleteBankEntry } from
"./firestore/bankEntries";
import { withTimeout } from "./utils/crud";
















const BankContext = createContext(null);

export function BankProvider({ children }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToBankEntries(
      (rows) => {setEntries(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const createEntry = useCallback(async (data) => {
    return withTimeout(fsCreateBankEntry(data));
  }, []);

  const deleteEntry = useCallback(async (id) => {
    await withTimeout(fsDeleteBankEntry(id));
  }, []);

  const value = useMemo(
    () => ({ entries, loading, createEntry, deleteEntry }),
    [entries, loading, createEntry, deleteEntry]
  );

  return <BankContext.Provider value={value}>{children}</BankContext.Provider>;
}

export function useBank(clientId, category) {
  const ctx = useContext(BankContext);
  if (!ctx) throw new Error("useBank must be used inside <BankProvider>");
  let filtered = ctx.entries;
  if (clientId) filtered = filtered.filter((e) => e.clientId === clientId);
  if (category) filtered = filtered.filter((e) => e.category === category);
  return { ...ctx, filtered };
}