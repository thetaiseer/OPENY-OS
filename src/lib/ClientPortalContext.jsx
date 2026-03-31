"use client";

// ============================================================
// OPENY OS – Client Portal Context (Firestore-backed)
// Phase 4: Client Portal – Safe Data Layer
// ============================================================
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState } from

"react";
import {
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy } from
"firebase/firestore";
import { db, wsCol, DEFAULT_WORKSPACE_ID } from "./firebase";








// ── Client-safe content ───────────────────────────────────────

/** Strip internal-only fields before exposing to client. */
function sanitizeContentItem(item) {
  return {
    ...item,
    // Remove any internal comments (only keep non-internal ones)
    comments: (item.comments ?? []).filter(
      (c) => !c.isInternal
    )
  };
}

function sanitizeApproval(approval) {
  return {
    ...approval,
    // Clients should NOT see internal comments
    internalComments: []
  };
}

// ── Context shape ─────────────────────────────────────────────














const ClientPortalContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────







export function ClientPortalProvider({ clientId, clientData, children }) {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [contentItems, setContentItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    // Content items for this client (only client-safe statuses)
    const contentUnsub = onSnapshot(
      query(
        wsCol("contentItems"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        // Only expose client-safe content (not idea/draft/in_progress/internal_review stages)
        const clientVisible = items.
        filter((i) =>
        [
        "client_review",
        "approved",
        "scheduled",
        "publishing_ready",
        "published"].
        includes(i.status)
        ).
        map(sanitizeContentItem);
        setContentItems(clientVisible);
        setLoading(false);
      },
      (err) => console.error("[OPENY] ClientPortal content error:", err)
    );

    // Approvals for this client
    const approvalsUnsub = onSnapshot(
      query(
        wsCol("approvals"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const approvals = snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        // Only show pending_client and resolved approvals
        const visible = approvals.
        filter((a) =>
        ["pending_client", "approved", "rejected", "revision_requested"].includes(
          a.status
        )
        ).
        map(sanitizeApproval);
        setPendingApprovals(visible);
      },
      (err) => console.error("[OPENY] ClientPortal approvals error:", err)
    );

    // Assets for this client
    const assetsUnsub = onSnapshot(
      query(
        wsCol("assets"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setAssets(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      },
      (err) => console.error("[OPENY] ClientPortal assets error:", err)
    );

    return () => {
      contentUnsub();
      approvalsUnsub();
      assetsUnsub();
    };
  }, [clientId]);

  const publishedItems = useMemo(
    () => contentItems.filter((i) => i.status === "published"),
    [contentItems]
  );

  // ── Client Actions ────────────────────────────────────────

  const clientApprove = useCallback(
    async (approvalId, comment) => {
      const now = new Date().toISOString();
      const updateData = {
        status: "approved",
        updatedAt: now
      };
      if (comment) {
        const approval = pendingApprovals.find((a) => a.id === approvalId);
        const newComment = {
          id: crypto.randomUUID(),
          userId: `client_${clientId}`,
          userName: clientData?.name ?? "Client",
          userInitials: clientData?.initials ?? "CL",
          userColor: clientData?.color ?? "var(--accent)",
          text: comment,
          isInternal: false,
          createdAt: now
        };
        updateData.clientComments = [
        ...(approval?.clientComments ?? []),
        newComment];

      }
      await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", approvalId), updateData);
      // Log activity
      await addDoc(wsCol("activities"), {
        type: "post_approved_by_client",
        message: `Post approved by client: ${clientData?.name ?? "Client"}`,
        detail: `Approval ${approvalId}`,
        entityId: approvalId,
        timestamp: now
      });
      // Push notification
      await addDoc(wsCol("notifications"), {
        type: "client_approved",
        title: "Client Approved",
        message: `${clientData?.name ?? "Client"} approved a content item`,
        entityId: approvalId,
        isRead: false,
        createdAt: now
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const clientReject = useCallback(
    async (approvalId, reason) => {
      const now = new Date().toISOString();
      const approval = pendingApprovals.find((a) => a.id === approvalId);
      const newComment = {
        id: crypto.randomUUID(),
        userId: `client_${clientId}`,
        userName: clientData?.name ?? "Client",
        userInitials: clientData?.initials ?? "CL",
        userColor: clientData?.color ?? "var(--accent)",
        text: reason,
        isInternal: false,
        createdAt: now
      };
      await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", approvalId), {
        status: "rejected",
        clientComments: [...(approval?.clientComments ?? []), newComment],
        updatedAt: now
      });
      await addDoc(wsCol("activities"), {
        type: "publishing_failed",
        message: `Post rejected by client: ${clientData?.name ?? "Client"}`,
        detail: reason,
        entityId: approvalId,
        timestamp: now
      });
      await addDoc(wsCol("notifications"), {
        type: "client_rejected",
        title: "Client Rejected",
        message: `${clientData?.name ?? "Client"} rejected a content item`,
        entityId: approvalId,
        isRead: false,
        createdAt: now
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const clientRequestChanges = useCallback(
    async (approvalId, note) => {
      const now = new Date().toISOString();
      const approval = pendingApprovals.find((a) => a.id === approvalId);
      const newComment = {
        id: crypto.randomUUID(),
        userId: `client_${clientId}`,
        userName: clientData?.name ?? "Client",
        userInitials: clientData?.initials ?? "CL",
        userColor: clientData?.color ?? "var(--accent)",
        text: note,
        isInternal: false,
        createdAt: now
      };
      await updateDoc(doc(db, "workspaces", DEFAULT_WORKSPACE_ID, "approvals", approvalId), {
        status: "revision_requested",
        clientComments: [...(approval?.clientComments ?? []), newComment],
        updatedAt: now
      });
      await addDoc(wsCol("activities"), {
        type: "client_requested_changes",
        message: `Client requested changes: ${clientData?.name ?? "Client"}`,
        detail: note,
        entityId: approvalId,
        timestamp: now
      });
      await addDoc(wsCol("notifications"), {
        type: "client_requested_changes",
        title: "Changes Requested",
        message: `${clientData?.name ?? "Client"} requested changes`,
        entityId: approvalId,
        isRead: false,
        createdAt: now
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const value = useMemo(
    () => ({
      client: clientData,
      pendingApprovals,
      contentItems,
      publishedItems,
      assets,
      loading,
      clientApprove,
      clientReject,
      clientRequestChanges
    }),
    [
    clientData,
    pendingApprovals,
    contentItems,
    publishedItems,
    assets,
    loading,
    clientApprove,
    clientReject,
    clientRequestChanges]

  );

  return (
    <ClientPortalContext.Provider value={value}>
      {children}
    </ClientPortalContext.Provider>);

}

export function useClientPortal() {
  const ctx = useContext(ClientPortalContext);
  if (!ctx)
  throw new Error(
    "useClientPortal must be used inside <ClientPortalProvider>"
  );
  return ctx;
}