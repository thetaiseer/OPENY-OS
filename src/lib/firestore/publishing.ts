// ============================================================
// OPENY OS – Firestore Service: publishing
// Single source of truth:
//   workspaces/main/publishingEvents
//   workspaces/main/publishingFailures
// ============================================================
import {
  addDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { PublishingEvent, PublishingFailure, FailureReason, PublishingStatus } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:publishing]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:publishing]", ...args);
}

// ── Subscribe: events ─────────────────────────────────────────

export function subscribeToPublishingEvents(
  callback: (rows: PublishingEvent[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/publishingEvents");
  const q = query(wsCol("publishingEvents"), orderBy("scheduledAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PublishingEvent));
      log("publishingEvents snapshot – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("publishingEvents snapshot error:", err);
      onError?.(err);
    }
  );
}

// ── Subscribe: failures ───────────────────────────────────────

export function subscribeToPublishingFailures(
  callback: (rows: PublishingFailure[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/publishingFailures");
  const q = query(wsCol("publishingFailures"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PublishingFailure));
      log("publishingFailures snapshot – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("publishingFailures snapshot error:", err);
      onError?.(err);
    }
  );
}

// ── Create event ──────────────────────────────────────────────

export async function createPublishingEvent(
  payload: Omit<PublishingEvent, "id">
): Promise<string> {
  log("createPublishingEvent", payload);
  const docRef = await addDoc(wsCol("publishingEvents"), payload);
  log("created event id:", docRef.id);
  return docRef.id;
}

// ── Update event ──────────────────────────────────────────────

export async function updatePublishingEvent(
  id: string,
  data: Partial<Omit<PublishingEvent, "id" | "createdAt">>
): Promise<void> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updatePublishingEvent id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "publishingEvents", id),
    payload
  );
  log("updated event", id);
}

// ── Record failure ────────────────────────────────────────────

export async function recordPublishingFailure(
  payload: Omit<PublishingFailure, "id">
): Promise<string> {
  log("recordPublishingFailure", payload);
  const docRef = await addDoc(wsCol("publishingFailures"), payload);
  log("created failure id:", docRef.id);
  return docRef.id;
}
