// ============================================================
// OPENY OS – Firestore Service: workspace
// Single source of truth: workspaces/main (document)
// ============================================================
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db, DEFAULT_WORKSPACE_ID } from "@/lib/firebase";
import type { Workspace } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:workspace]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:workspace]", ...args);
}

const workspaceDocRef = () =>
  doc(db, "workspaces", DEFAULT_WORKSPACE_ID);

// ── Read ─────────────────────────────────────────────────────

export async function getWorkspace(): Promise<Workspace | null> {
  log("getWorkspace");
  try {
    const snap = await getDoc(workspaceDocRef());
    if (!snap.exists()) {
      log("workspace doc not found");
      return null;
    }
    return { id: snap.id, ...snap.data() } as Workspace;
  } catch (err) {
    logError("getWorkspace error:", err);
    return null;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────
// Creates the workspace document if it does not exist yet.

export async function bootstrapWorkspace(
  overrides?: Partial<Omit<Workspace, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  log("bootstrapWorkspace");
  const snap = await getDoc(workspaceDocRef());
  if (snap.exists()) {
    log("workspace already exists – skipping bootstrap");
    return;
  }
  const now = new Date().toISOString();
  const payload: Omit<Workspace, "id"> = {
    name: overrides?.name ?? "OPENY Workspace",
    companyName: overrides?.companyName ?? "Openy",
    logoUrl: overrides?.logoUrl ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(workspaceDocRef(), payload);
  log("workspace bootstrapped", DEFAULT_WORKSPACE_ID);
}

// ── Update ───────────────────────────────────────────────────

export async function updateWorkspace(
  payload: Partial<Omit<Workspace, "id" | "createdAt">>
): Promise<void> {
  log("updateWorkspace", payload);
  await updateDoc(workspaceDocRef(), {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
  log("workspace updated");
}
