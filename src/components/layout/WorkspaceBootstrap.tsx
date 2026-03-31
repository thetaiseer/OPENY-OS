"use client";

// ============================================================
// OPENY OS – WorkspaceBootstrap
// Invisible component that ensures the root workspace document
// (workspaces/main) exists in Firestore before any CRUD
// operations are attempted.  Runs once per browser session.
// ============================================================
import { useEffect } from "react";
import { bootstrapWorkspace } from "@/lib/firestore/workspace";

export function WorkspaceBootstrap() {
  useEffect(() => {
    bootstrapWorkspace().catch((err) => {
      console.error("[OPENY:WorkspaceBootstrap] failed:", err);
    });
  }, []);

  return null;
}
