 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
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


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:publishing]", ...args);
}

function logError(...args) {
  console.error("[OPENY:publishing]", ...args);
}

// ── Subscribe: events ─────────────────────────────────────────

export function subscribeToPublishingEvents(
  callback,
  onError
) {
  log("subscribing to workspaces/main/publishingEvents");
  const q = query(wsCol("publishingEvents"), orderBy("scheduledAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } ));
      log("publishingEvents snapshot – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("publishingEvents snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _ => _(err)]);
    }
  );
}

// ── Subscribe: failures ───────────────────────────────────────

export function subscribeToPublishingFailures(
  callback,
  onError
) {
  log("subscribing to workspaces/main/publishingFailures");
  const q = query(wsCol("publishingFailures"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } ));
      log("publishingFailures snapshot – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("publishingFailures snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _2 => _2(err)]);
    }
  );
}

// ── Create event ──────────────────────────────────────────────

export async function createPublishingEvent(
  payload
) {
  log("createPublishingEvent", payload);
  const docRef = await addDoc(wsCol("publishingEvents"), payload);
  log("created event id:", docRef.id);
  return docRef.id;
}

// ── Update event ──────────────────────────────────────────────

export async function updatePublishingEvent(
  id,
  data
) {
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
  payload
) {
  log("recordPublishingFailure", payload);
  const docRef = await addDoc(wsCol("publishingFailures"), payload);
  log("created failure id:", docRef.id);
  return docRef.id;
}
