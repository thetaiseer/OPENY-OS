// ============================================================
// OPENY OS – Firestore Service: content (contentItems)
// Single source of truth: workspaces/main/contentItems
// ============================================================
import {
  addDoc,
  arrayUnion,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { ContentItem, ContentComment } from "@/lib/types";
import type { CreateContentData } from "@/lib/ContentContext";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:contentItems]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:contentItems]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToContentItems(
  callback: (rows: ContentItem[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/contentItems");
  const q = query(wsCol("contentItems"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContentItem));
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      onError?.(err);
    }
  );
}

// ── Create ───────────────────────────────────────────────────

export async function createContentItem(data: CreateContentData): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
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
  };
  log("createContentItem", payload);
  const docRef = await addDoc(wsCol("contentItems"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateContentItem(
  id: string,
  data: Partial<Omit<ContentItem, "id" | "createdAt">>
): Promise<void> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateContentItem id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "contentItems", id),
    payload
  );
  log("updated", id);
}

// ── Add comment ──────────────────────────────────────────────

export async function addContentComment(
  id: string,
  comment: Omit<ContentComment, "id">
): Promise<void> {
  const newComment: ContentComment = { ...comment, id: crypto.randomUUID() };
  log("addContentComment id:", id, newComment);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "contentItems", id),
    {
      comments: arrayUnion(newComment),
      updatedAt: new Date().toISOString(),
    }
  );
  log("comment added to", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteContentItem(id: string): Promise<void> {
  log("deleteContentItem id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "contentItems", id));
  log("deleted", id);
}
