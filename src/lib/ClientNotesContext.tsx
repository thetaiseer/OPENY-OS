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
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { ClientNote, NoteType } from "./types";

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
    const unsub = onSnapshot(
      query(collection(db, "clientNotes"), orderBy("createdAt", "desc")),
      (snap) => {
        setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientNote)));
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] Firestore listener error for clientNotes:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const createNote = useCallback(async (data: CreateNoteData): Promise<string> => {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, "clientNotes"), {
      clientId: data.clientId,
      type: data.type,
      content: data.content,
      author: data.author,
      tag: data.tag ?? "",
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }, []);

  const updateNote = useCallback(
    async (id: string, data: Partial<Omit<ClientNote, "id" | "createdAt">>) => {
      await updateDoc(doc(db, "clientNotes", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const deleteNote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "clientNotes", id));
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
