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
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Approval, ApprovalComment, ApprovalWorkflowStatus } from "./types";

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
    const unsub = onSnapshot(
      query(collection(db, "approvals"), orderBy("createdAt", "desc")),
      (snap) => {
        setApprovals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Approval)));
        setLoading(false);
      },
      (err) => {
        console.error("[OPENY] Firestore listener error for approvals:", err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const createApproval = useCallback(async (data: CreateApprovalData): Promise<string> => {
    const now = new Date().toISOString();
    const docRef = await addDoc(collection(db, "approvals"), {
      contentItemId: data.contentItemId,
      clientId: data.clientId,
      status: data.status ?? "pending_internal",
      assignedTo: data.assignedTo ?? "",
      internalComments: [],
      clientComments: [],
      createdAt: now,
      updatedAt: now,
    });
    return docRef.id;
  }, []);

  const updateApproval = useCallback(
    async (id: string, data: Partial<Omit<Approval, "id" | "createdAt">>) => {
      await updateDoc(doc(db, "approvals", id), {
        ...data,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const addInternalComment = useCallback(
    async (id: string, comment: Omit<ApprovalComment, "id">) => {
      const approval = approvals.find((a) => a.id === id);
      if (!approval) return;
      const newComment: ApprovalComment = { ...comment, id: crypto.randomUUID() };
      await updateDoc(doc(db, "approvals", id), {
        internalComments: [...(approval.internalComments ?? []), newComment],
        updatedAt: new Date().toISOString(),
      });
    },
    [approvals],
  );

  const addClientComment = useCallback(
    async (id: string, comment: Omit<ApprovalComment, "id">) => {
      const approval = approvals.find((a) => a.id === id);
      if (!approval) return;
      const newComment: ApprovalComment = { ...comment, id: crypto.randomUUID() };
      await updateDoc(doc(db, "approvals", id), {
        clientComments: [...(approval.clientComments ?? []), newComment],
        updatedAt: new Date().toISOString(),
      });
    },
    [approvals],
  );

  const updateApprovalStatus = useCallback(
    async (id: string, status: ApprovalWorkflowStatus) => {
      await updateDoc(doc(db, "approvals", id), {
        status,
        updatedAt: new Date().toISOString(),
      });
    },
    [],
  );

  const deleteApproval = useCallback(async (id: string) => {
    await deleteDoc(doc(db, "approvals", id));
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
