// ============================================================
// OPENY OS – Firestore Service: contentVersions
// Subcollection path: workspaces/main/contentItems/{contentId}/versions
// ============================================================
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { ContentVersion } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:contentVersions]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:contentVersions]", ...args);
}

function versionsCol(contentItemId: string) {
  return collection(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "contentItems",
    contentItemId,
    "versions"
  );
}

function versionDoc(contentItemId: string, versionId: string) {
  return doc(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "contentItems",
    contentItemId,
    "versions",
    versionId
  );
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToContentVersions(
  contentItemId: string,
  callback: (rows: ContentVersion[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to versions for content:", contentItemId);
  const q = query(versionsCol(contentItemId), orderBy("versionNumber", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        contentItemId,
        ...d.data(),
      } as ContentVersion));
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

export interface CreateContentVersionData {
  contentItemId: string;
  versionNumber: number;
  previewUrl: string;
  storagePath: string;
  uploadedBy: string;
  note?: string;
}

export async function createContentVersion(
  data: CreateContentVersionData
): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    versionNumber: data.versionNumber,
    previewUrl: data.previewUrl,
    storagePath: data.storagePath,
    uploadedBy: data.uploadedBy,
    note: data.note ?? "",
    createdAt: now,
  };
  log("createContentVersion for content:", data.contentItemId, payload);
  const docRef = await addDoc(versionsCol(data.contentItemId), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteContentVersion(
  contentItemId: string,
  versionId: string
): Promise<void> {
  log("deleteContentVersion contentItemId:", contentItemId, "id:", versionId);
  await deleteDoc(versionDoc(contentItemId, versionId));
  log("deleted", versionId);
}
