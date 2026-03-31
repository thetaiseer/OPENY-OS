"use client";

// ============================================================
// OPENY OS – Content Planner Store (Firestore Edition)
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect } from

"react";









import {
  subscribeToContentItems,
  createContentItem as fsCreateContentItem,
  updateContentItem as fsUpdateContentItem,
  deleteContentItem as fsDeleteContentItem,
  addContentComment as fsAddContentComment } from
"./firestore/content";
import { withTimeout } from "./utils/crud";

// ── Context shape ─────────────────────────────────────────────



























const ContentContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────

export function ContentProvider({ children }) {
  const [contentItems, setContentItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Firestore real-time listener (via service layer) ─────
  useEffect(() => {
    const unsub = subscribeToContentItems(
      (rows) => {setContentItems(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  // ── CRUD actions (via service layer) ─────────────────────

  const createContentItem = useCallback(async (data) => {
    return withTimeout(fsCreateContentItem(data));
  }, []);

  const updateContentItem = useCallback(
    async (id, data) => {
      await withTimeout(fsUpdateContentItem(id, data));
    },
    []
  );

  const deleteContentItem = useCallback(async (id) => {
    await withTimeout(fsDeleteContentItem(id));
  }, []);

  const addComment = useCallback(
    async (id, comment) => {
      await withTimeout(fsAddContentComment(id, comment));
    },
    []
  );

  const value = useMemo(
    () => ({
      contentItems,
      loading,
      createContentItem,
      updateContentItem,
      deleteContentItem,
      addComment
    }),
    [contentItems, loading, createContentItem, updateContentItem, deleteContentItem, addComment]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

// ── Consumer hook ──────────────────────────────────────────────

export function useContentItems() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContentItems must be used inside <ContentProvider>");
  return ctx;
}