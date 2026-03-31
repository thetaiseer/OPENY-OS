"use client";

// ============================================================
// OPENY OS – Client Approval Card
// Phase 4: Client Portal
// ============================================================
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Calendar,
  Monitor } from
"lucide-react";










export function ClientApprovalCard({
  approval,
  contentItem,
  onApprove,
  onReject,
  onRequestChanges
}) {
  const [action, setAction] = useState(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const isPending = approval.status === "pending_client";

  const handleSubmit = async () => {
    if (!action) return;
    setLoading(true);
    try {
      if (action === "approve") {
        await onApprove(approval.id, comment || undefined);
      } else if (action === "reject") {
        await onReject(approval.id, comment || "Rejected");
      } else {
        await onRequestChanges(approval.id, comment || "Changes requested");
      }
      setAction(null);
      setComment("");
    } finally {
      setLoading(false);
    }
  };

  const statusColor =
  approval.status === "approved" ?
  "#34d399" :
  approval.status === "rejected" ?
  "#f87171" :
  approval.status === "revision_requested" ?
  "#fbbf24" :
  "#4f8ef7";

  const statusLabel =
  approval.status === "approved" ?
  "Approved" :
  approval.status === "rejected" ?
  "Rejected" :
  approval.status === "revision_requested" ?
  "Changes Requested" :
  "Awaiting Your Review";

  return (
    <div
      className="rounded-2xl p-4 space-y-4"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)"
      }}>
      
      {/* Status banner */}
      <div
        className="flex items-center justify-between rounded-xl px-3 py-2"
        style={{
          background: `${statusColor}18`,
          border: `1px solid ${statusColor}30`
        }}>
        
        <span
          className="text-xs font-semibold"
          style={{ color: statusColor }}>
          
          {statusLabel}
        </span>
        {contentItem &&
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{
            background: "var(--surface-3)",
            color: "var(--text-muted)"
          }}>
          
            {contentItem.platform}
          </span>
        }
      </div>

      {/* Content preview */}
      {contentItem &&
      <div className="space-y-2">
          <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}>
          
            {contentItem.title}
          </h3>

          {contentItem.caption &&
        <p
          className="text-xs leading-relaxed line-clamp-3"
          style={{ color: "var(--text-secondary)" }}>
          
              {contentItem.caption}
            </p>
        }

          <div className="flex items-center gap-3 flex-wrap">
            {contentItem.scheduledDate &&
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}>
            
                <Calendar size={11} />
                {contentItem.scheduledDate}
              </span>
          }
            <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}>
            
              <Monitor size={11} />
              {contentItem.platform}
            </span>
            {contentItem.contentType &&
          <span
            className="text-[10px] px-2 py-0.5 rounded-full capitalize"
            style={{
              background: "var(--surface-3)",
              color: "var(--text-muted)"
            }}>
            
                {contentItem.contentType}
              </span>
          }
          </div>

          {contentItem.attachments && contentItem.attachments.length > 0 &&
        <p
          className="text-[11px]"
          style={{ color: "var(--text-muted)" }}>
          
              📎 {contentItem.attachments.length} attachment
              {contentItem.attachments.length > 1 ? "s" : ""}
            </p>
        }
        </div>
      }

      {/* Client comments */}
      {approval.clientComments && approval.clientComments.length > 0 &&
      <div className="space-y-2">
          <p
          className="text-[11px] font-medium uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}>
          
            Comments
          </p>
          {approval.clientComments.map((c) =>
        <div
          key={c.id}
          className="flex gap-2">
          
              <div
            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
            style={{ background: c.userColor ?? "var(--accent)" }}>
            
                {c.userInitials}
              </div>
              <div className="flex-1 min-w-0">
                <span
              className="text-xs"
              style={{ color: "var(--text-secondary)" }}>
              
                  {c.text}
                </span>
              </div>
            </div>
        )}
        </div>
      }

      {/* Action buttons (only for pending_client) */}
      {isPending &&
      <div className="space-y-3">
          {!action ?
        <div className="flex gap-2 flex-wrap">
              <button
            onClick={() => setAction("approve")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-1"
            style={{
              background: "rgba(52,211,153,0.15)",
              color: "#34d399",
              border: "1px solid rgba(52,211,153,0.3)"
            }}>
            
                <CheckCircle2 size={12} />
                Approve
              </button>
              <button
            onClick={() => setAction("reject")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-1"
            style={{
              background: "rgba(248,113,113,0.1)",
              color: "#f87171",
              border: "1px solid rgba(248,113,113,0.2)"
            }}>
            
                <XCircle size={12} />
                Reject
              </button>
              <button
            onClick={() => setAction("changes")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-1"
            style={{
              background: "rgba(251,191,36,0.1)",
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.2)"
            }}>
            
                <MessageSquare size={12} />
                Request Changes
              </button>
            </div> :

        <div className="space-y-2">
              <p
            className="text-xs font-medium"
            style={{ color: "var(--text-secondary)" }}>
            
                {action === "approve" ?
            "Add a comment (optional)" :
            action === "reject" ?
            "Reason for rejection" :
            "What changes are needed?"}
              </p>
              <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
            action === "approve" ?
            "Looks great!" :
            action === "reject" ?
            "Please explain why…" :
            "Describe the changes needed…"
            }
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)"
            }} />
          
              <div className="flex gap-2">
                <button
              onClick={() => {setAction(null);setComment("");}}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: "var(--surface-3)",
                color: "var(--text-secondary)"
              }}>
              
                  Back
                </button>
                <button
              onClick={handleSubmit}
              disabled={loading || action !== "approve" && !comment.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-medium transition-all disabled:opacity-50"
              style={{
                background:
                action === "approve" ?
                "rgba(52,211,153,0.2)" :
                action === "reject" ?
                "rgba(248,113,113,0.2)" :
                "rgba(251,191,36,0.2)",
                color:
                action === "approve" ?
                "#34d399" :
                action === "reject" ?
                "#f87171" :
                "#fbbf24"
              }}>
              
                  {loading ?
              "Submitting…" :
              action === "approve" ?
              "Confirm Approve" :
              action === "reject" ?
              "Confirm Reject" :
              "Submit Changes"}
                </button>
              </div>
            </div>
        }
        </div>
      }
    </div>);

}