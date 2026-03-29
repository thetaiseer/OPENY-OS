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
  useState,
  type ReactNode,
} from "react";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  ContentItem,
  Approval,
  ApprovalComment,
  Asset,
  Client,
} from "./types";

// ── Client-safe content ───────────────────────────────────────

/** Strip internal-only fields before exposing to client. */
function sanitizeContentItem(item: ContentItem): ContentItem {
  return {
    ...item,
    // Remove any internal comments (only keep non-internal ones)
    comments: (item.comments ?? []).filter(
      (c) => !(c as { isInternal?: boolean }).isInternal
    ),
  };
}

function sanitizeApproval(approval: Approval): Approval {
  return {
    ...approval,
    // Clients should NOT see internal comments
    internalComments: [],
  };
}

// ── Context shape ─────────────────────────────────────────────

interface ClientPortalContextValue {
  client: Client | null;
  pendingApprovals: Approval[];
  contentItems: ContentItem[];
  publishedItems: ContentItem[];
  assets: Asset[];
  loading: boolean;
  // Actions
  clientApprove: (approvalId: string, comment?: string) => Promise<void>;
  clientReject: (approvalId: string, reason: string) => Promise<void>;
  clientRequestChanges: (approvalId: string, note: string) => Promise<void>;
}

const ClientPortalContext = createContext<ClientPortalContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientData: Client | null;
  children: ReactNode;
}

export function ClientPortalProvider({ clientId, clientData, children }: Props) {
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    // Content items for this client (only client-safe statuses)
    const contentUnsub = onSnapshot(
      query(
        collection(db, "contentItems"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as ContentItem));
        // Only expose client-safe content (not idea/draft/in_progress/internal_review stages)
        const clientVisible = items
          .filter((i) =>
            [
              "client_review",
              "approved",
              "scheduled",
              "publishing_ready",
              "published",
            ].includes(i.status)
          )
          .map(sanitizeContentItem);
        setContentItems(clientVisible);
        setLoading(false);
      },
      (err) => console.error("[OPENY] ClientPortal content error:", err)
    );

    // Approvals for this client
    const approvalsUnsub = onSnapshot(
      query(
        collection(db, "approvals"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        const approvals = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as Approval));
        // Only show pending_client and resolved approvals
        const visible = approvals
          .filter((a) =>
            ["pending_client", "approved", "rejected", "revision_requested"].includes(
              a.status
            )
          )
          .map(sanitizeApproval);
        setPendingApprovals(visible);
      },
      (err) => console.error("[OPENY] ClientPortal approvals error:", err)
    );

    // Assets for this client
    const assetsUnsub = onSnapshot(
      query(
        collection(db, "assets"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc")
      ),
      (snap) => {
        setAssets(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as Asset))
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
    async (approvalId: string, comment?: string) => {
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        status: "approved",
        updatedAt: now,
      };
      if (comment) {
        const approval = pendingApprovals.find((a) => a.id === approvalId);
        const newComment: ApprovalComment = {
          id: crypto.randomUUID(),
          userId: `client_${clientId}`,
          userName: clientData?.name ?? "Client",
          userInitials: (clientData?.initials ?? "CL"),
          userColor: clientData?.color ?? "var(--accent)",
          text: comment,
          isInternal: false,
          createdAt: now,
        };
        updateData.clientComments = [
          ...(approval?.clientComments ?? []),
          newComment,
        ];
      }
      await updateDoc(doc(db, "approvals", approvalId), updateData);
      // Log activity
      await addDoc(collection(db, "activities"), {
        type: "post_approved_by_client",
        message: `Post approved by client: ${clientData?.name ?? "Client"}`,
        detail: `Approval ${approvalId}`,
        entityId: approvalId,
        timestamp: now,
      });
      // Push notification
      await addDoc(collection(db, "notifications"), {
        type: "client_approved",
        title: "Client Approved",
        message: `${clientData?.name ?? "Client"} approved a content item`,
        entityId: approvalId,
        isRead: false,
        createdAt: now,
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const clientReject = useCallback(
    async (approvalId: string, reason: string) => {
      const now = new Date().toISOString();
      const approval = pendingApprovals.find((a) => a.id === approvalId);
      const newComment: ApprovalComment = {
        id: crypto.randomUUID(),
        userId: `client_${clientId}`,
        userName: clientData?.name ?? "Client",
        userInitials: clientData?.initials ?? "CL",
        userColor: clientData?.color ?? "var(--accent)",
        text: reason,
        isInternal: false,
        createdAt: now,
      };
      await updateDoc(doc(db, "approvals", approvalId), {
        status: "rejected",
        clientComments: [...(approval?.clientComments ?? []), newComment],
        updatedAt: now,
      });
      await addDoc(collection(db, "activities"), {
        type: "publishing_failed",
        message: `Post rejected by client: ${clientData?.name ?? "Client"}`,
        detail: reason,
        entityId: approvalId,
        timestamp: now,
      });
      await addDoc(collection(db, "notifications"), {
        type: "client_rejected",
        title: "Client Rejected",
        message: `${clientData?.name ?? "Client"} rejected a content item`,
        entityId: approvalId,
        isRead: false,
        createdAt: now,
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const clientRequestChanges = useCallback(
    async (approvalId: string, note: string) => {
      const now = new Date().toISOString();
      const approval = pendingApprovals.find((a) => a.id === approvalId);
      const newComment: ApprovalComment = {
        id: crypto.randomUUID(),
        userId: `client_${clientId}`,
        userName: clientData?.name ?? "Client",
        userInitials: clientData?.initials ?? "CL",
        userColor: clientData?.color ?? "var(--accent)",
        text: note,
        isInternal: false,
        createdAt: now,
      };
      await updateDoc(doc(db, "approvals", approvalId), {
        status: "revision_requested",
        clientComments: [...(approval?.clientComments ?? []), newComment],
        updatedAt: now,
      });
      await addDoc(collection(db, "activities"), {
        type: "client_requested_changes",
        message: `Client requested changes: ${clientData?.name ?? "Client"}`,
        detail: note,
        entityId: approvalId,
        timestamp: now,
      });
      await addDoc(collection(db, "notifications"), {
        type: "client_requested_changes",
        title: "Changes Requested",
        message: `${clientData?.name ?? "Client"} requested changes`,
        entityId: approvalId,
        isRead: false,
        createdAt: now,
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
      clientRequestChanges,
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
      clientRequestChanges,
    ]
  );

  return (
    <ClientPortalContext.Provider value={value}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal(): ClientPortalContextValue {
  const ctx = useContext(ClientPortalContext);
  if (!ctx)
    throw new Error(
      "useClientPortal must be used inside <ClientPortalProvider>"
    );
  return ctx;
}
