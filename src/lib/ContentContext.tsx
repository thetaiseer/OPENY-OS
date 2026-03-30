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
  useEffect,
  type ReactNode,
} from "react";
import type {
  ContentItem,
  ContentStatus,
  ContentPlatform,
  ContentType,
  ContentPriority,
  ApprovalStatus,
  ContentComment,
} from "./types";
import {
  subscribeToContentItems,
  createContentItem as fsCreateContentItem,
  updateContentItem as fsUpdateContentItem,
  deleteContentItem as fsDeleteContentItem,
  addContentComment as fsAddContentComment,
} from "./firestore/content";
import { withTimeout } from "./utils/crud";

// ── Context shape ─────────────────────────────────────────────

export type CreateContentData = {
  clientId: string;
  title: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  platform: ContentPlatform;
  contentType: ContentType;
  status?: ContentStatus;
  priority?: ContentPriority;
  assignedTo?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  approvalStatus?: ApprovalStatus;
  attachments?: string[];
};

interface ContentContextValue {
  contentItems: ContentItem[];
  loading: boolean;
  createContentItem: (data: CreateContentData) => Promise<string>;
  updateContentItem: (id: string, data: Partial<Omit<ContentItem, "id" | "createdAt">>) => Promise<void>;
  deleteContentItem: (id: string) => Promise<void>;
  addComment: (id: string, comment: Omit<ContentComment, "id">) => Promise<void>;
}

const ContentContext = createContext<ContentContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function ContentProvider({ children }: { children: ReactNode }) {
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Firestore real-time listener (via service layer) ─────
  useEffect(() => {
    const unsub = subscribeToContentItems(
      (rows) => { setContentItems(rows); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  // ── CRUD actions (via service layer) ─────────────────────

  const createContentItem = useCallback(async (data: CreateContentData): Promise<string> => {
    return withTimeout(fsCreateContentItem(data));
  }, []);

  const updateContentItem = useCallback(
    async (id: string, data: Partial<Omit<ContentItem, "id" | "createdAt">>) => {
      await withTimeout(fsUpdateContentItem(id, data));
    },
    [],
  );

  const deleteContentItem = useCallback(async (id: string) => {
    await withTimeout(fsDeleteContentItem(id));
  }, []);

  const addComment = useCallback(
    async (id: string, comment: Omit<ContentComment, "id">) => {
      await withTimeout(fsAddContentComment(id, comment));
    },
    [],
  );

  const value: ContentContextValue = useMemo(
    () => ({
      contentItems,
      loading,
      createContentItem,
      updateContentItem,
      deleteContentItem,
      addComment,
    }),
    [contentItems, loading, createContentItem, updateContentItem, deleteContentItem, addComment],
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

// ── Consumer hook ──────────────────────────────────────────────

export function useContentItems(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContentItems must be used inside <ContentProvider>");
  return ctx;
}
