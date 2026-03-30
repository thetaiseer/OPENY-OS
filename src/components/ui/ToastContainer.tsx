"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToast } from "@/lib/ToastContext";

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 end-6 z-[300] flex flex-col gap-3" aria-live="polite">
      {toasts.map((toast) => {
        const isSuccess = toast.type === "success";
        const isError = toast.type === "error";
        const color = isSuccess ? "var(--mint)" : isError ? "var(--rose)" : "var(--accent)";
        const Icon = isSuccess ? CheckCircle2 : isError ? XCircle : Info;

        return (
          <div
            key={toast.id}
            className="flex items-center gap-3 rounded-[20px] border border-[var(--border)] px-4 py-3 shadow-xl"
            style={{
              background: "var(--panel-strong)",
              minWidth: "280px",
              maxWidth: "400px",
            }}
          >
            <Icon size={18} style={{ color, flexShrink: 0 }} />
            <span className="flex-1 text-sm font-medium text-[var(--text)]">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-full p-1 text-[var(--muted)] transition hover:text-[var(--text)]"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
