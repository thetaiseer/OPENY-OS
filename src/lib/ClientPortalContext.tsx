"use client";

// ============================================================
// OPENY OS – Client Portal Context (Supabase-backed)
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
import { getSupabaseClient } from "./supabase/client";
import { rowToCamel } from "./supabase/helpers";

// ── Client-safe content ───────────────────────────────────────

function sanitizeContentItem(item: Record<string, unknown>) {
  return {
    ...item,
    comments: ((item.comments as unknown[]) ?? []).filter(
      (c: unknown) => !(c as { isInternal?: boolean }).isInternal
    ),
  };
}

function sanitizeApproval(approval: Record<string, unknown>) {
  return { ...approval, internalComments: [] };
}

const ClientPortalContext = createContext(null);

export function ClientPortalProvider({ clientId, clientData, children }) {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [contentItems, setContentItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;
    const sb = getSupabaseClient();

    const fetchContent = async () => {
      const { data } = await sb
        .from("content_items")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      const items = (data ?? []).map((r) => rowToCamel(r));
      const clientVisible = items
        .filter((i) =>
          ["client_review", "approved", "scheduled", "publishing_ready", "published"].includes(
            (i as any).status
          )
        )
        .map(sanitizeContentItem);
      setContentItems(clientVisible as any);
      setLoading(false);
    };

    const fetchApprovals = async () => {
      const { data } = await sb
        .from("approvals")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      const approvals = (data ?? []).map((r) => rowToCamel(r));
      const visible = approvals
        .filter((a) =>
          ["pending_client", "approved", "rejected", "revision_requested"].includes((a as any).status)
        )
        .map(sanitizeApproval);
      setPendingApprovals(visible as any);
    };

    const fetchAssets = async () => {
      const { data } = await sb
        .from("assets")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      setAssets(((data ?? []).map((r) => rowToCamel(r))) as any);
    };

    fetchContent();
    fetchApprovals();
    fetchAssets();

    // Real-time subscriptions
    const channel = sb
      .channel(`portal-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "content_items" }, fetchContent)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, fetchApprovals)
      .on("postgres_changes", { event: "*", schema: "public", table: "assets" }, fetchAssets)
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [clientId]);

  const publishedItems = useMemo(
    () => contentItems.filter((i: any) => i.status === "published"),
    [contentItems]
  );

  // ── Client Actions ────────────────────────────────────────

  const clientApprove = useCallback(
    async (approvalId: string, comment?: string) => {
      const sb = getSupabaseClient();
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = { status: "approved", updated_at: now };
      if (comment) {
        const approval = (pendingApprovals as any[]).find((a) => a.id === approvalId);
        const newComment = {
          id: crypto.randomUUID(),
          userId: `client_${clientId}`,
          userName: clientData?.name ?? "Client",
          userInitials: clientData?.initials ?? "CL",
          userColor: clientData?.color ?? "var(--accent)",
          text: comment,
          isInternal: false,
          createdAt: now,
        };
        updateData.client_comments = [...((approval?.clientComments as unknown[]) ?? []), newComment];
      }
      await sb.from("approvals").update(updateData).eq("id", approvalId);
      await sb.from("activities").insert({
        type: "post_approved_by_client",
        message: `Post approved by client: ${clientData?.name ?? "Client"}`,
        detail: `Approval ${approvalId}`,
        entity_id: approvalId,
        timestamp: now,
      });
      await sb.from("notifications").insert({
        type: "client_approved",
        title: "Client Approved",
        message: `${clientData?.name ?? "Client"} approved a content item`,
        entity_id: approvalId,
        is_read: false,
        created_at: now,
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const clientReject = useCallback(
    async (approvalId: string, reason: string) => {
      const sb = getSupabaseClient();
      const now = new Date().toISOString();
      const approval = (pendingApprovals as any[]).find((a) => a.id === approvalId);
      const newComment = {
        id: crypto.randomUUID(),
        userId: `client_${clientId}`,
        userName: clientData?.name ?? "Client",
        userInitials: clientData?.initials ?? "CL",
        userColor: clientData?.color ?? "var(--accent)",
        text: reason,
        isInternal: false,
        createdAt: now,
      };
      await sb.from("approvals").update({
        status: "rejected",
        client_comments: [...((approval?.clientComments as unknown[]) ?? []), newComment],
        updated_at: now,
      }).eq("id", approvalId);
      await sb.from("activities").insert({
        type: "publishing_failed",
        message: `Post rejected by client: ${clientData?.name ?? "Client"}`,
        detail: reason,
        entity_id: approvalId,
        timestamp: now,
      });
      await sb.from("notifications").insert({
        type: "client_rejected",
        title: "Client Rejected",
        message: `${clientData?.name ?? "Client"} rejected a content item`,
        entity_id: approvalId,
        is_read: false,
        created_at: now,
      });
    },
    [clientId, clientData, pendingApprovals]
  );

  const clientRequestChanges = useCallback(
    async (approvalId: string, note: string) => {
      const sb = getSupabaseClient();
      const now = new Date().toISOString();
      const approval = (pendingApprovals as any[]).find((a) => a.id === approvalId);
      const newComment = {
        id: crypto.randomUUID(),
        userId: `client_${clientId}`,
        userName: clientData?.name ?? "Client",
        userInitials: clientData?.initials ?? "CL",
        userColor: clientData?.color ?? "var(--accent)",
        text: note,
        isInternal: false,
        createdAt: now,
      };
      await sb.from("approvals").update({
        status: "revision_requested",
        client_comments: [...((approval?.clientComments as unknown[]) ?? []), newComment],
        updated_at: now,
      }).eq("id", approvalId);
      await sb.from("activities").insert({
        type: "client_requested_changes",
        message: `Client requested changes: ${clientData?.name ?? "Client"}`,
        detail: note,
        entity_id: approvalId,
        timestamp: now,
      });
      await sb.from("notifications").insert({
        type: "client_requested_changes",
        title: "Changes Requested",
        message: `${clientData?.name ?? "Client"} requested changes`,
        entity_id: approvalId,
        is_read: false,
        created_at: now,
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
    [clientData, pendingApprovals, contentItems, publishedItems, assets, loading, clientApprove, clientReject, clientRequestChanges]
  );

  return (
    <ClientPortalContext.Provider value={value}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal() {
  const ctx = useContext(ClientPortalContext);
  if (!ctx)
    throw new Error("useClientPortal must be used inside <ClientPortalProvider>");
  return ctx;
}
