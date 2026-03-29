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
import type { ClientNote, NoteType } from "./types";
import {
  subscribeToClientNotes,
  createClientNote as fsCreateClientNote,
  updateClientNote as fsUpdateClientNote,
  deleteClientNote as fsDeleteClientNote,
} from "./firestore/clientNotes";

export type CreateNoteData = {
  clientId: string;
  type: NoteType;
  content: string;
  author: string;
  tag?: string;
};

interface ClientNotesContextValue {
  notes: ClientNote[];
  loading: boolean;
  createNote: (data: CreateNoteData) => Promise<string>;
  updateNote: (id: string, data: Partial<Omit<ClientNote, "id" | "createdAt">>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}

const ClientNotesContext = createContext<ClientNotesContextValue | null>(null);

export function ClientNotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToClientNotes(
      (rows) => { setNotes(rows); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const createNote = useCallback(async (data: CreateNoteData): Promise<string> => {
    return fsCreateClientNote(data);
  }, []);

  const updateNote = useCallback(
    async (id: string, data: Partial<Omit<ClientNote, "id" | "createdAt">>) => {
      await fsUpdateClientNote(id, data);
    },
    [],
  );

  const deleteNote = useCallback(async (id: string) => {
    await fsDeleteClientNote(id);
  }, []);

  const value: ClientNotesContextValue = useMemo(
    () => ({ notes, loading, createNote, updateNote, deleteNote }),
    [notes, loading, createNote, updateNote, deleteNote],
  );

  return <ClientNotesContext.Provider value={value}>{children}</ClientNotesContext.Provider>;
}

export function useClientNotes(clientId?: string): ClientNotesContextValue & { filtered: ClientNote[] } {
  const ctx = useContext(ClientNotesContext);
  if (!ctx) throw new Error("useClientNotes must be used inside <ClientNotesProvider>");
  const filtered = clientId ? ctx.notes.filter((n) => n.clientId === clientId) : ctx.notes;
  return { ...ctx, filtered };
}
