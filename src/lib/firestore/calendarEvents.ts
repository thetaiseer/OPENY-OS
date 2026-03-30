// ============================================================
// OPENY OS – Firestore Service: calendarEvents
// Single source of truth: workspaces/main/calendarEvents
// ============================================================
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:calendarEvents]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:calendarEvents]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToCalendarEvents(
  callback: (rows: CalendarEvent[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/calendarEvents");
  const q = query(wsCol("calendarEvents"), orderBy("startAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CalendarEvent)
      );
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      onError?.(err);
    }
  );
}

/** Subscribe to calendar events for a specific client. */
export function subscribeToClientCalendarEvents(
  clientId: string,
  callback: (rows: CalendarEvent[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to calendarEvents for client:", clientId);
  const q = query(
    wsCol("calendarEvents"),
    where("clientId", "==", clientId),
    orderBy("startAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as CalendarEvent)
      );
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

export interface CreateCalendarEventData {
  title: string;
  clientId?: string | null;
  type: CalendarEventType;
  relatedId?: string | null;
  startAt: string;
  endAt?: string | null;
}

export async function createCalendarEvent(
  data: CreateCalendarEventData
): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    title: data.title,
    clientId: data.clientId ?? null,
    type: data.type,
    relatedId: data.relatedId ?? null,
    startAt: data.startAt,
    endAt: data.endAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
  log("createCalendarEvent", payload);
  const docRef = await addDoc(wsCol("calendarEvents"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateCalendarEvent(
  id: string,
  data: Partial<Omit<CalendarEvent, "id" | "createdAt">>
): Promise<void> {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateCalendarEvent id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "calendarEvents", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteCalendarEvent(id: string): Promise<void> {
  log("deleteCalendarEvent id:", id);
  await deleteDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "calendarEvents", id)
  );
  log("deleted", id);
}
