// ============================================================
// OPENY OS – Firestore Service: team
// Single source of truth: workspaces/main/team
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
import type { TeamMember } from "@/lib/types";

const DEV = process.env.NODE_ENV !== "production";

function log(...args: unknown[]) {
  if (DEV) console.log("[OPENY:team]", ...args);
}

function logError(...args: unknown[]) {
  console.error("[OPENY:team]", ...args);
}

// ── Subscribe ────────────────────────────────────────────────

export function subscribeToTeam(
  callback: (rows: TeamMember[]) => void,
  onError?: (err: unknown) => void
): () => void {
  log("subscribing to workspaces/main/team");
  const q = query(wsCol("team"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamMember));
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

export async function createTeamMember(
  payload: Omit<TeamMember, "id">
): Promise<string> {
  log("createTeamMember", payload);
  const docRef = await addDoc(wsCol("team"), payload);
  log("created doc id:", docRef.id);
  return docRef.id;
}

// ── Update ───────────────────────────────────────────────────

export async function updateTeamMember(
  id: string,
  payload: Partial<Omit<TeamMember, "id">>
): Promise<void> {
  log("updateTeamMember id:", id, payload);
  await updateDoc(
    doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "team", id),
    payload
  );
  log("updated", id);
}

// ── Delete ───────────────────────────────────────────────────

export async function deleteTeamMember(id: string): Promise<void> {
  log("deleteTeamMember id:", id);
  await deleteDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "team", id));
  log("deleted", id);
}
