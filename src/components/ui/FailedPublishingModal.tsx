"use client";

// ============================================================
// OPENY OS – Failed Publishing Modal
// Phase 4: Publishing Workflow
// ============================================================
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { FailureReason } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: FailureReason, note: string) => Promise<void>;
  itemTitle?: string;
}

const REASONS: { value: FailureReason; label: string }[] = [
  { value: "missing_asset", label: "Missing Asset" },
  { value: "rejected_by_client", label: "Rejected by Client" },
  { value: "missed_schedule", label: "Missed Schedule" },
  { value: "platform_issue", label: "Platform Issue" },
  { value: "manual_delay", label: "Manual Delay" },
  { value: "other", label: "Other" },
];

export function FailedPublishingModal({ open, onClose, onConfirm, itemTitle }: Props) {
  const [reason, setReason] = useState<FailureReason>("other");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(reason, note);
      setNote("");
      setReason("other");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Mark as Failed">
      <div className="space-y-4">
        {itemTitle && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
            style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}
          >
            <AlertTriangle size={14} />
            <span className="font-medium truncate">{itemTitle}</span>
          </div>
        )}

        <div>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: "var(--text-secondary)" }}
          >
            Failure Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as FailureReason)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: "var(--text-secondary)" }}
          >
            Additional Notes
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what happened..."
            rows={3}
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: "rgba(248,113,113,0.15)",
              color: "#f87171",
              border: "1px solid rgba(248,113,113,0.3)",
            }}
          >
            {loading ? "Saving…" : "Mark as Failed"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
