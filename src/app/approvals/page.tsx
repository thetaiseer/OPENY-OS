"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { ApprovalCommentThread } from "@/components/approvals/ApprovalCommentThread";
import type { Approval, ApprovalWorkflowStatus } from "@/lib/types";

type FilterTab = "all" | ApprovalWorkflowStatus;

const TABS: { key: FilterTab; labelKey: string }[] = [
  { key: "all",                labelKey: "approvals.all" },
  { key: "pending_internal",   labelKey: "approvals.pendingInternal" },
  { key: "pending_client",     labelKey: "approvals.pendingClient" },
  { key: "approved",           labelKey: "approvals.approved" },
  { key: "rejected",           labelKey: "approvals.rejected" },
  { key: "revision_requested", labelKey: "approvals.revisionRequested" },
];

export default function ApprovalsPage() {
  const { t } = useLanguage();
  const { approvals, loading, addInternalComment, addClientComment } = useApprovals();
  const { contentItems } = useContentItems();

  const { clients } = useAppStore();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === "all") return approvals;
    return approvals.filter((a) => a.status === activeTab);
  }, [approvals, activeTab]);

  const handleAddComment = async (text: string, isInternal: boolean) => {
    if (!selectedApproval) return;
    if (isInternal) {
      await addInternalComment(selectedApproval.id, {
        userId: "current_user",
        userName: "You",
        userInitials: "YO",
        userColor: "var(--accent)",
        text,
        isInternal: true,
        createdAt: new Date().toISOString(),
      });
    } else {
      await addClientComment(selectedApproval.id, {
        userId: "current_user",
        userName: "You",
        userInitials: "YO",
        userColor: "var(--accent)",
        text,
        isInternal: false,
        createdAt: new Date().toISOString(),
      });
    }
  };

  // Get the live version of selected approval (for comments updates)
  const liveSelected = selectedApproval
    ? approvals.find((a) => a.id === selectedApproval.id) ?? selectedApproval
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {t("approvals.title")}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {filtered.length} {t("approvals.title").toLowerCase()}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap p-1 rounded-xl w-fit" style={{ background: "var(--surface-3)" }}>
        {TABS.map(({ key, labelKey }) => {
          const count = key === "all" ? approvals.length : approvals.filter((a) => a.status === key).length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: activeTab === key ? "var(--surface-1)" : "transparent",
                color: activeTab === key ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {t(labelKey as Parameters<typeof t>[0])}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ background: activeTab === key ? "var(--accent)" : "var(--surface-4)", color: activeTab === key ? "white" : "var(--text-muted)" }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t("approvals.noApprovals")}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("approvals.noApprovalsDesc")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((approval) => {
            const contentItem = contentItems.find((ci) => ci.id === approval.contentItemId);
            return (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                contentItem={contentItem}
                clients={clients}
                onClick={() => setSelectedApproval(approval)}
              />
            );
          })}
        </div>
      )}

      {/* Detail panel / modal */}
      {liveSelected && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)", zIndex: 9999, display: "flex",
            alignItems: "flex-start", justifyContent: "center",
            padding: "40px 16px", overflowY: "auto",
          }}
          onClick={() => setSelectedApproval(null)}
        >
          <div
            style={{
              background: "var(--surface-1)", border: "1px solid var(--border)",
              borderRadius: "20px", width: "100%", maxWidth: "680px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  {contentItems.find((ci) => ci.id === liveSelected.contentItemId)?.title ?? "—"}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {clients.find((c) => c.id === liveSelected.clientId)?.name ?? ""}
                </p>
              </div>
              <button
                onClick={() => setSelectedApproval(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Comment threads */}
            <div className="px-6 py-5 space-y-6">
              <ApprovalCommentThread
                comments={liveSelected.internalComments ?? []}
                onAdd={handleAddComment}
                currentUserName="You"
                currentUserInitials="YO"
                currentUserColor="var(--accent)"
                title={t("approvals.internalComments")}
              />
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                <ApprovalCommentThread
                  comments={liveSelected.clientComments ?? []}
                  onAdd={async (text) => {
                    await addClientComment(liveSelected.id, {
                      userId: "current_user",
                      userName: "You",
                      userInitials: "YO",
                      userColor: "var(--accent)",
                      text,
                      isInternal: false,
                      createdAt: new Date().toISOString(),
                    });
                  }}
                  currentUserName="You"
                  currentUserInitials="YO"
                  currentUserColor="var(--accent)"
                  title={t("approvals.clientComments")}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
