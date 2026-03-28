"use client";

// ============================================================
// OPENY OS – Reschedule Modal
// Phase 4: Publishing Workflow
// ============================================================
import { useState } from "react";
import { Calendar } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (date: string, time: string) => Promise<void>;
  itemTitle?: string;
  currentDate?: string;
  currentTime?: string;
}

export function RescheduleModal({
  open,
  onClose,
  onConfirm,
  itemTitle,
  currentDate,
  currentTime,
}: Props) {
  const [date, setDate] = useState(currentDate ?? "");
  const [time, setTime] = useState(currentTime ?? "");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!date) return;
    setLoading(true);
    try {
      await onConfirm(date, time);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Reschedule Post">
      <div className="space-y-4">
        {itemTitle && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
            style={{
              background: "rgba(167,139,250,0.1)",
              color: "#a78bfa",
            }}
          >
            <Calendar size={14} />
            <span className="font-medium truncate">{itemTitle}</span>
          </div>
        )}

        <div>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: "var(--text-secondary)" }}
          >
            New Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        <div>
          <label
            className="text-xs font-medium mb-1.5 block"
            style={{ color: "var(--text-secondary)" }}
          >
            New Time (optional)
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
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
            disabled={loading || !date}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: "rgba(167,139,250,0.15)",
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.3)",
            }}
          >
            {loading ? "Saving…" : "Reschedule"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
