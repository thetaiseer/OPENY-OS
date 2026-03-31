 function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// ============================================================
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


const DEV = process.env.NODE_ENV !== "production";

function log(...args) {
  if (DEV) console.log("[OPENY:workspace]", ...args);
}

function logError(...args) {
  console.error("[OPENY:workspace]", ...args);
}

const workspaceDocRef = () =>
  doc(db, "workspaces", DEFAULT_WORKSPACE_ID);

// ── Read ─────────────────────────────────────────────────────

export async function getWorkspace() {
  log("getWorkspace");
  try {
    const snap = await getDoc(workspaceDocRef());
    if (!snap.exists()) {
      log("workspace doc not found");
      return null;
    }
    return { id: snap.id, ...snap.data() } ;
  } catch (err) {
    logError("getWorkspace error:", err);
    return null;
  }
}

// ── Bootstrap ─────────────────────────────────────────────────
// Creates the workspace document if it does not exist yet.

export async function bootstrapWorkspace(
  overrides?
) {
  log("bootstrapWorkspace");
  const snap = await getDoc(workspaceDocRef());
  if (snap.exists()) {
    log("workspace already exists – skipping bootstrap");
    return;
  }
  const now = new Date().toISOString();
  const payload = {
    name: _nullishCoalesce(_optionalChain([overrides, 'optionalAccess', _ => _.name]), () => ( "OPENY Workspace")),
    companyName: _nullishCoalesce(_optionalChain([overrides, 'optionalAccess', _2 => _2.companyName]), () => ( "Openy")),
    logoUrl: _nullishCoalesce(_optionalChain([overrides, 'optionalAccess', _3 => _3.logoUrl]), () => ( null)),
    createdAt: now,
    updatedAt: now,
  };
  await setDoc(workspaceDocRef(), payload);
  log("workspace bootstrapped", DEFAULT_WORKSPACE_ID);
}

// ── Update ───────────────────────────────────────────────────

export async function updateWorkspace(
  payload
) {
  log("updateWorkspace", payload);
  await updateDoc(workspaceDocRef(), {
    ...payload,
    updatedAt: new Date().toISOString(),
  });
  log("workspace updated");
}
