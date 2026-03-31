 function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: recurringTaskTemplates
// Single source of truth: workspaces/main/recurringTaskTemplates
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


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:recurringTasks]", ...args);
}

function logError(...args) {
  console.error("[OPENY:recurringTasks]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToRecurringTaskTemplates(
  callback,
  onError
) {
  log("subscribing to workspaces/main/recurringTaskTemplates");
  const q = query(wsCol("recurringTaskTemplates"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } ));
      log("snapshot received – docs:", rows.length);
      callback(rows);
    },
    (err) => {
      logError("snapshot error:", err);
      _optionalChain([onError, 'optionalCall', _ => _(err)]);
    }
  );
}

// ── Create ───────────────────────────────────────────────────

export async function createRecurringTaskTemplate(
  payload
) {
  log("createRecurringTaskTemplate", payload);
  const docRef = await addDoc(wsCol("recurringTaskTemplates"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateRecurringTaskTemplate(
  id,
  payload
) {
  log("updateRecurringTaskTemplate id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "recurringTaskTemplates", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteRecurringTaskTemplate(id) {
  log("deleteRecurringTaskTemplate id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "recurringTaskTemplates", id));
  log("deleted", id);
}
