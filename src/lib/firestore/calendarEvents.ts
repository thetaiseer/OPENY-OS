 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
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


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:calendarEvents]", ...args);
}

function logError(...args) {
  console.error("[OPENY:calendarEvents]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToCalendarEvents(
  callback,
  onError
) {
  log("subscribing to workspaces/main/calendarEvents");
  const q = query(wsCol("calendarEvents"), orderBy("startAt", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } )
      );
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _ => _(err)]);
    }
  );
}

/** Subscribe to calendar events for a specific client. */
export function subscribeToClientCalendarEvents(
  clientId,
  callback,
  onError
) {
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
        (d) => ({ id: d.id, ...d.data() } )
      );
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _2 => _2(err)]);
    }
  );
}

// ── Create ───────────────────────────────────────────────────










export async function createCalendarEvent(
  data
) {
  const now = new Date().toISOString();
  const payload = {
    title: data.title,
    clientId: _nullishCoalesce(data.clientId, () => ( null)),
    type: data.type,
    relatedId: _nullishCoalesce(data.relatedId, () => ( null)),
    startAt: data.startAt,
    endAt: _nullishCoalesce(data.endAt, () => ( null)),
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
  id,
  data
) {
  const payload = { ...data, updatedAt: new Date().toISOString() };
  log("updateCalendarEvent id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "calendarEvents", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteCalendarEvent(id) {
  log("deleteCalendarEvent id:", id);
  await deleteDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "calendarEvents", id)
  );
  log("deleted", id);
}
