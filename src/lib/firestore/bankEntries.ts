// ============================================================
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
import type { BankEntry } from "@/lib/types";
import type { CreateBankEntryData } from "@/lib/BankContext";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:bankEntries]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:bankEntries]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToBankEntries(
  callback: (rows: BankEntry[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/bankEntries");
  const q = query(wsCol("bankEntries"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankEntry));
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

export async function createBankEntry(data: CreateBankEntryData): Promise<string> {
  const payload = {
    clientId: data.clientId,
    category: data.category,
    text: data.text,
    tags: data.tags ?? [],
    platform: data.platform ?? null,
    createdAt: new Date().toISOString(),
  };
  log("createBankEntry", payload);
  const docRef = await addDoc(wsCol("bankEntries"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteBankEntry(id: string): Promise<void> {
  log("deleteBankEntry id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "bankEntries", id));
  log("deleted", id);
}
