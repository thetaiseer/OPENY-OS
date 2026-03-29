// ============================================================
// OPENY OS – Firestore Service: assets
// Single source of truth: workspaces/main/assets
// ============================================================
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { Asset } from "@/lib/types";
import type { CreateAssetData } from "@/lib/AssetsContext";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:assets]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:assets]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToAssets(
  callback: (rows: Asset[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/assets");
  const q = query(wsCol("assets"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset));
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

export async function createAsset(data: CreateAssetData): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    clientId: data.clientId,
    name: data.name,
    type: data.type,
    fileUrl: data.fileUrl,
    thumbnailUrl: data.thumbnailUrl ?? "",
    fileSize: data.fileSize ?? 0,
    format: data.format ?? "",
    tags: data.tags ?? [],
    folder: data.folder ?? "",
    uploadedBy: data.uploadedBy ?? "",
    createdAt: now,
    updatedAt: now,
  };
  log("createAsset", payload);
  const docRef = await addDoc(wsCol("assets"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateAsset(
  id: string,
  data: Partial<Omit<Asset, "id" | "createdAt">>
): Promise<void> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateAsset id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "assets", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteAsset(id: string): Promise<void> {
  log("deleteAsset id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "assets", id));
  log("deleted", id);
}
