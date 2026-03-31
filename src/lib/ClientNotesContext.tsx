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
  subscribeToClientNotes,
  createClientNote as fsCreateClientNote,
  updateClientNote as fsUpdateClientNote,
  deleteClientNote as fsDeleteClientNote } from
"./firestore/clientNotes";
import { withTimeout } from "./utils/crud";

















const ClientNotesContext = createContext(null);

export function ClientNotesProvider({ children }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToClientNotes(
      (rows) => {setNotes(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const createNote = useCallback(async (data) => {
    return withTimeout(fsCreateClientNote(data));
  }, []);

  const updateNote = useCallback(
    async (id, data) => {
      await withTimeout(fsUpdateClientNote(id, data));
    },
    []
  );

  const deleteNote = useCallback(async (id) => {
    await withTimeout(fsDeleteClientNote(id));
  }, []);

  const value = useMemo(
    () => ({ notes, loading, createNote, updateNote, deleteNote }),
    [notes, loading, createNote, updateNote, deleteNote]
  );

  return <ClientNotesContext.Provider value={value}>{children}</ClientNotesContext.Provider>;
}

export function useClientNotes(clientId) {
  const ctx = useContext(ClientNotesContext);
  if (!ctx) throw new Error("useClientNotes must be used inside <ClientNotesProvider>");
  const filtered = clientId ? ctx.notes.filter((n) => n.clientId === clientId) : ctx.notes;
  return { ...ctx, filtered };
}