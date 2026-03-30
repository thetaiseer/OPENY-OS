"use client";

// ============================================================
// OPENY OS – Approval Workflow Store (Firestore Edition)
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import type { Approval, ApprovalComment, ApprovalWorkflowStatus } from "./types";
import {
  subscribeToApprovals,
  createApproval as fsCreateApproval,
  updateApproval as fsUpdateApproval,
  updateApprovalStatus as fsUpdateApprovalStatus,
  addApprovalInternalComment,
  addApprovalClientComment,
  deleteApproval as fsDeleteApproval,
} from "./firestore/approvals";
import { withTimeout } from "./utils/crud";

// ── Context shape ─────────────────────────────────────────────

export type CreateApprovalData = {
  contentItemId: string;
  clientId: string;
  assignedTo?: string;
  status?: ApprovalWorkflowStatus;
};

interface ApprovalContextValue {
  approvals: Approval[];
  loading: boolean;
  createApproval: (data: CreateApprovalData) => Promise<string>;
  updateApproval: (id: string, data: Partial<Omit<Approval, "id" | "createdAt">>) => Promise<void>;
  addInternalComment: (id: string, comment: Omit<ApprovalComment, "id">) => Promise<void>;
  addClientComment: (id: string, comment: Omit<ApprovalComment, "id">) => Promise<void>;
  updateApprovalStatus: (id: string, status: ApprovalWorkflowStatus) => Promise<void>;
  deleteApproval: (id: string) => Promise<void>;
}

const ApprovalContext = createContext<ApprovalContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

export function ApprovalProvider({ children }: { children: ReactNode }) {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToApprovals(
      (rows) => { setApprovals(rows); setLoading(false); },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const createApproval = useCallback(async (data: CreateApprovalData): Promise<string> => {
    return withTimeout(fsCreateApproval(data));
  }, []);

  const updateApproval = useCallback(
    async (id: string, data: Partial<Omit<Approval, "id" | "createdAt">>) => {
      await withTimeout(fsUpdateApproval(id, data));
    },
    [],
  );

  const addInternalComment = useCallback(
    async (id: string, comment: Omit<ApprovalComment, "id">) => {
      await withTimeout(addApprovalInternalComment(id, comment));
    },
    [],
  );

  const addClientComment = useCallback(
    async (id: string, comment: Omit<ApprovalComment, "id">) => {
      await withTimeout(addApprovalClientComment(id, comment));
    },
    [],
  );

  const updateApprovalStatus = useCallback(
    async (id: string, status: ApprovalWorkflowStatus) => {
      await withTimeout(fsUpdateApprovalStatus(id, status));
    },
    [],
  );

  const deleteApproval = useCallback(async (id: string) => {
    await withTimeout(fsDeleteApproval(id));
  }, []);

  const value: ApprovalContextValue = useMemo(
    () => ({
      approvals,
      loading,
      createApproval,
      updateApproval,
      addInternalComment,
      addClientComment,
      updateApprovalStatus,
      deleteApproval,
    }),
    [approvals, loading, createApproval, updateApproval, addInternalComment, addClientComment, updateApprovalStatus, deleteApproval],
  );

  return <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>;
}

export function useApprovals(): ApprovalContextValue {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApprovals must be used inside <ApprovalProvider>");
  return ctx;
}
