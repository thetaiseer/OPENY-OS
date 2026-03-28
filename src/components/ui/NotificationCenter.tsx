"use client";

// ============================================================
// OPENY OS – Notification Center (premium popover)
// ============================================================
import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import { writeBatch, doc as fbDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNotifications } from "@/lib/NotificationContext";
import type { AppNotification, NotificationType } from "@/lib/types";

// ── Icon / color per notification type ───────────────────────

const TYPE_META: Record<
  NotificationType,
  { label: string; dot: string }
> = {
  client_created:  { label: "Client",  dot: "#4f8ef7" },
  client_updated:  { label: "Client",  dot: "#4f8ef7" },
  project_created: { label: "Project", dot: "#a78bfa" },
  project_updated: { label: "Project", dot: "#a78bfa" },
  task_created:    { label: "Task",    dot: "#fbbf24" },
  task_updated:    { label: "Task",    dot: "#fbbf24" },
  task_completed:  { label: "Task",    dot: "#34d399" },
  member_invited:  { label: "Team",    dot: "#f87171" },
  member_added:    { label: "Team",    dot: "#34d399" },
  invite_accepted: { label: "Invite",  dot: "#34d399" },
  status_change:   { label: "System",  dot: "#8888a0" },
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Single notification row ───────────────────────────────────

function NotificationRow({
  n,
  onRead,
  onDelete,
}: {
  n: AppNotification;
  onRead: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_META[n.type] ?? { label: "System", dot: "#8888a0" };

  return (
    <div
      className="group flex items-start gap-3 px-4 py-3 transition-all cursor-pointer"
      style={{
        background: n.isRead ? "transparent" : "rgba(79,142,247,0.06)",
        borderBottom: "1px solid var(--border)",
      }}
      onClick={onRead}
    >
      {/* Dot */}
      <div className="flex-shrink-0 mt-1">
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: n.isRead ? "var(--border-strong)" : meta.dot }}
        />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{
              background: `${meta.dot}20`,
              color: meta.dot,
            }}
          >
            {meta.label}
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {formatRelativeTime(n.createdAt)}
          </span>
        </div>
        <p
          className="text-[13px] font-medium leading-snug"
          style={{ color: n.isRead ? "var(--text-secondary)" : "var(--text-primary)" }}
        >
          {n.title}
        </p>
        <p className="text-[12px] leading-snug mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {n.message}
        </p>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center"
        style={{ background: "var(--surface-4)", color: "var(--text-muted)" }}
        title="Remove"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: open ? "var(--accent-dim)" : "var(--surface-2)",
          color: open ? "var(--accent)" : "var(--text-secondary)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border)"}`,
        }}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -end-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
            style={{ background: "#f87171" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute end-0 top-11 z-50 flex flex-col"
          style={{
            width: "360px",
            maxWidth: "calc(100vw - 24px)",
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            maxHeight: "520px",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3.5 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}
                >
                  {unreadCount} unread
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all"
                  style={{
                    background: "var(--surface-3)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                  title="Mark all as read"
                >
                  <CheckCheck size={11} />
                  <span>All read</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
              >
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: "var(--surface-3)" }}
                >
                  <Bell size={20} style={{ color: "var(--text-muted)" }} />
                </div>
                <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                  No notifications
                </p>
                <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                  System events and updates will appear here
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  n={n}
                  onRead={() => { if (!n.isRead) markAsRead(n.id); }}
                  onDelete={() => deleteNotification(n.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="px-4 py-3 flex-shrink-0 flex items-center justify-between"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {notifications.length} total
              </span>
              <button
                onClick={async () => {
                  const read = notifications.filter((n) => n.isRead);
                  if (read.length === 0) return;
                  const batch = writeBatch(db);
                  read.forEach((n) => batch.delete(fbDoc(db, "notifications", n.id)));
                  await batch.commit();
                }}
                className="flex items-center gap-1 text-[11px]"
                style={{ color: "var(--text-muted)" }}
              >
                <Trash2 size={10} />
                Clear read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
