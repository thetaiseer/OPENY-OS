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
import type {
  ContentItem,
  ContentStatus,
  ContentPlatform,
  ContentType,
  ContentPriority,
  ApprovalStatus,
  ContentComment,
} from "./types";

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

  // ── Firestore real-time listener ──────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "contentItems"), orderBy("createdAt", "desc")),
      (snap) => {
        setContentItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentItem)));
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] Firestore listener error for contentItems:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  // ── CRUD actions ──────────────────────────────────────────

  const createContentItem = useCallback(async (data: CreateContentData): Promise<string> => {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, "contentItems"), {
      clientId: data.clientId,
      title: data.title,
      description: data.description ?? "",
      caption: data.caption ?? "",
      hashtags: data.hashtags ?? [],
      platform: data.platform,
      contentType: data.contentType,
      status: data.status ?? "idea",
      priority: data.priority ?? "medium",
      assignedTo: data.assignedTo ?? "",
      scheduledDate: data.scheduledDate ?? "",
      scheduledTime: data.scheduledTime ?? "",
      publishedAt: null,
      approvalStatus: data.approvalStatus ?? "pending_internal",
      attachments: data.attachments ?? [],
      comments: [],
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }, []);

  const updateContentItem = useCallback(
    async (id: string, data: Partial<Omit<ContentItem, "id" | "createdAt">>) => {
      await updateDoc(doc(db, "contentItems", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const deleteContentItem = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "contentItems", id));
  }, []);

  const addComment = useCallback(
    async (id: string, comment: Omit<ContentComment, "id">) => {
      const item = contentItems.find((c) => c.id === id);
      if (!item) return;
      const newComment: ContentComment = {
        ...comment,
        id: crypto.randomUUID(),
      };
      await updateDoc(doc(db, "contentItems", id), {
        comments: [...(item.comments ?? []), newComment],
        updatedAt: new Date().toISOString(),
      });
    },
    [contentItems],
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
