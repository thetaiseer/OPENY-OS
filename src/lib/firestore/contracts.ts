// ============================================================
// OPENY OS – Firestore Service: contracts
// Subcollection path: workspaces/main/clients/{clientId}/contracts
// ============================================================
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { Contract, ContractStatus } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:contracts]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:contracts]", ...args);
}

function contractsCol(clientId: string) {
  return collection(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "clients",
    clientId,
    "contracts"
  );
}

function contractDoc(clientId: string, contractId: string) {
  return doc(
    db,
    "workspaces",
    DEFAULT_WORKSPACE_ID,
    "clients",
    clientId,
    "contracts",
    contractId
  );
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToContracts(
  clientId: string,
  callback: (rows: Contract[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to contracts for client:", clientId);
  const q = query(contractsCol(clientId), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        clientId,
        ...d.data(),
      } as Contract));
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

export interface CreateContractData {
  clientId: string;
  title: string;
  fileUrl: string;
  storagePath: string;
  startDate?: string | null;
  endDate?: string | null;
  status?: ContractStatus;
  uploadedBy?: string;
}

export async function createContract(data: CreateContractData): Promise<string> {
  const now = new Date().toISOString();
  const payload = {
    title: data.title,
    fileUrl: data.fileUrl,
    storagePath: data.storagePath,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    status: data.status ?? "draft",
    uploadedBy: data.uploadedBy ?? "",
    createdAt: now,
  };
  log("createContract for client:", data.clientId, payload);
  const docRef = await addDoc(contractsCol(data.clientId), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateContract(
  clientId: string,
  contractId: string,
  data: Partial<Omit<Contract, "id" | "clientId" | "createdAt">>
): Promise<void> {
  log("updateContract clientId:", clientId, "id:", contractId, data);
  await updateDoc(contractDoc(clientId, contractId), data);
  log("updated", contractId);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteContract(
  clientId: string,
  contractId: string
): Promise<void> {
  log("deleteContract clientId:", clientId, "id:", contractId);
  await deleteDoc(contractDoc(clientId, contractId));
  log("deleted", contractId);
}
