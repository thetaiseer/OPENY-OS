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
  useEffect } from

"react";

import {
  subscribeToApprovals,
  createApproval as fsCreateApproval,
  updateApproval as fsUpdateApproval,
  updateApprovalStatus as fsUpdateApprovalStatus,
  addApprovalInternalComment,
  addApprovalClientComment,
  deleteApproval as fsDeleteApproval } from
"./firestore/approvals";
import { withTimeout } from "./utils/crud";

// ── Context shape ─────────────────────────────────────────────



















const ApprovalContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────

export function ApprovalProvider({ children }) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToApprovals(
      (rows) => {setApprovals(rows);setLoading(false);},
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const createApproval = useCallback(async (data) => {
    return withTimeout(fsCreateApproval(data));
  }, []);

  const updateApproval = useCallback(
    async (id, data) => {
      await withTimeout(fsUpdateApproval(id, data));
    },
    []
  );

  const addInternalComment = useCallback(
    async (id, comment) => {
      await withTimeout(addApprovalInternalComment(id, comment));
    },
    []
  );

  const addClientComment = useCallback(
    async (id, comment) => {
      await withTimeout(addApprovalClientComment(id, comment));
    },
    []
  );

  const updateApprovalStatus = useCallback(
    async (id, status) => {
      await withTimeout(fsUpdateApprovalStatus(id, status));
    },
    []
  );

  const deleteApproval = useCallback(async (id) => {
    await withTimeout(fsDeleteApproval(id));
  }, []);

  const value = useMemo(
    () => ({
      approvals,
      loading,
      createApproval,
      updateApproval,
      addInternalComment,
      addClientComment,
      updateApprovalStatus,
      deleteApproval
    }),
    [approvals, loading, createApproval, updateApproval, addInternalComment, addClientComment, updateApprovalStatus, deleteApproval]
  );

  return <ApprovalContext.Provider value={value}>{children}</ApprovalContext.Provider>;
}

export function useApprovals() {
  const ctx = useContext(ApprovalContext);
  if (!ctx) throw new Error("useApprovals must be used inside <ApprovalProvider>");
  return ctx;
}