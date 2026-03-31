 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
// OPENY OS – Firestore Service: bankEntries
// Single source of truth: workspaces/main/bankEntries
// ============================================================
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";



const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:bankEntries]", ...args);
}

function logError(...args) {
  console.error("[OPENY:bankEntries]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToBankEntries(
  callback,
  onError
) {
  log("subscribing to workspaces/main/bankEntries");
  const q = query(wsCol("bankEntries"), orderBy("createdAt", "desc"));
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

export async function createBankEntry(data) {
  const payload = {
    clientId: data.clientId,
    category: data.category,
    text: data.text,
    tags: _nullishCoalesce(data.tags, () => ( [])),
    platform: _nullishCoalesce(data.platform, () => ( null)),
    createdAt: new Date().toISOString(),
  };
  log("createBankEntry", payload);
  const docRef = await addDoc(wsCol("bankEntries"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteBankEntry(id) {
  log("deleteBankEntry id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "bankEntries", id));
  log("deleted", id);
}
