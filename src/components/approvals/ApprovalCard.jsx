"use client";


import { useApprovals } from "@/lib/ApprovalContext";
import { useLanguage } from "@/lib/LanguageContext";
import { CheckCircle, XCircle, RefreshCw } from "lucide-react";

const STATUS_STYLES = {
  pending_internal: { bg: "#3b82f620", color: "#3b82f6" },
  pending_client: { bg: "#f59e0b20", color: "#f59e0b" },
  approved: { bg: "#10b98120", color: "#10b981" },
  rejected: { bg: "#ef444420", color: "#ef4444" },
  revision_requested: { bg: "#8b5cf620", color: "#8b5cf6" }
};

const STATUS_LABEL_KEYS = {
  pending_internal: "approvals.pendingInternal",
  pending_client: "approvals.pendingClient",
  approved: "approvals.approved",
  rejected: "approvals.rejected",
  revision_requested: "approvals.revisionRequested"
};








export function ApprovalCard({ approval, contentItem, clients, onClick }) {
  const { t } = useLanguage();
  const { updateApprovalStatus } = useApprovals();
  const client = clients.find((c) => c.id === approval.clientId);
  const style = STATUS_STYLES[approval.status] ?? STATUS_STYLES.pending_internal;
  const statusLabel = t(STATUS_LABEL_KEYS[approval.status] ?? "approvals.pendingInternal");

  const isPending = approval.status === "pending_internal" || approval.status === "pending_client";

  const handleAction = async (e, status) => {
    e.stopPropagation();
    await updateApprovalStatus(approval.id, status);
  };

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-5 cursor-pointer transition-all hover:scale-[1.01]"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {contentItem?.title ?? "—"}
          </p>
          {client &&
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{client.name}</p>
          }
        </div>
        <span
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0"
          style={{ background: style.bg, color: style.color }}>
          
          {statusLabel}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        {contentItem?.platform &&
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {contentItem.platform}
          </span>
        }
        {approval.assignedTo &&
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {t("approvals.assignedTo")}: {approval.assignedTo}
          </span>
        }
      </div>

      {/* Action buttons */}
      {isPending &&
      <div className="flex gap-2 flex-wrap pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
          onClick={(e) => handleAction(e, "approved")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: "#10b98120", color: "#10b981", border: "1px solid #10b98140" }}>
          
            <CheckCircle size={13} />
            {t("approvals.approve")}
          </button>
          <button
          onClick={(e) => handleAction(e, "rejected")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440" }}>
          
            <XCircle size={13} />
            {t("approvals.reject")}
          </button>
          <button
          onClick={(e) => handleAction(e, "revision_requested")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: "#f59e0b20", color: "#f59e0b", border: "1px solid #f59e0b40" }}>
          
            <RefreshCw size={13} />
            {t("approvals.requestChanges")}
          </button>
        </div>
      }
    </div>);

}