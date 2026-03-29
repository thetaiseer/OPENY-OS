"use client";

import { Paperclip, MessageSquare, Calendar, Pencil, Clock } from "lucide-react";
import { motion } from "framer-motion";
import type { ContentItem } from "@/lib/types";
import {
  PLATFORM_COLORS,
  PLATFORM_EMOJIS,
  PRIORITY_COLORS,
  STATUS_COLORS,
  CONTENT_TYPE_LABELS,
  formatDate,
  isOverdue,
} from "./contentUtils";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";
import { computeReadiness } from "@/lib/PublishingContext";
import { PublishingReadinessBadge } from "@/components/ui/PublishingReadinessBadge";

interface ContentCardProps {
  item: ContentItem;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

export function ContentCard({ item, onClick, draggable, onDragStart }: ContentCardProps) {
  const { t } = useLanguage();
  const { clients, members } = useAppStore();
  const client = clients.find((c) => c.id === item.clientId);
  const assignee = members.find((m) => m.id === item.assignedTo);
  const overdue = isOverdue(item.scheduledDate) && item.status !== "published";
  const readiness = computeReadiness(item);
  const platformColor = PLATFORM_COLORS[item.platform];
  const statusColor = STATUS_COLORS[item.status];

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="group"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="relative rounded-xl cursor-pointer select-none overflow-hidden"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderLeft: `3px solid ${statusColor}`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
        whileHover={{
          y: -2,
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          transition: { duration: 0.15 },
        }}
      >
      {/* Edit button — appears on hover */}
      <div
        className="absolute top-2 right-2 w-6 h-6 rounded-lg items-center justify-center hidden group-hover:flex transition-all"
        style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
      >
        <Pencil size={10} style={{ color: "var(--accent)" }} />
      </div>

      <div className="p-3">
        {/* Platform chip + content type */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{
              background: platformColor + "20",
              color: platformColor,
              border: `1px solid ${platformColor}35`,
            }}
          >
            <span style={{ fontSize: "8px" }}>{PLATFORM_EMOJIS[item.platform]}</span>
            {item.platform}
          </span>
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-md capitalize"
            style={{ background: "var(--surface-4)", color: "var(--text-secondary)" }}
          >
            {t(CONTENT_TYPE_LABELS[item.contentType] as Parameters<typeof t>[0])}
          </span>
          {item.priority === "high" && (
            <span
              className="text-[8px] font-bold px-1 py-0.5 rounded"
              style={{ background: PRIORITY_COLORS[item.priority] + "25", color: PRIORITY_COLORS[item.priority] }}
            >
              ↑ HIGH
            </span>
          )}
        </div>

        {/* Title */}
        <p
          className="text-xs font-semibold mb-1.5 leading-snug"
          style={{
            color: "var(--text-primary)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title}
        </p>

        {/* Caption preview */}
        {item.caption && (
          <p
            className="text-[10px] mb-2 truncate"
            style={{ color: "var(--text-muted)" }}
          >
            {item.caption}
          </p>
        )}

        {/* Client name */}
        {client && (
          <p className="text-[10px] mb-2 truncate font-medium" style={{ color: "var(--text-secondary)" }}>
            {client.name}
          </p>
        )}

        {/* Date row */}
        {item.scheduledDate && (
          <div className="flex items-center gap-1 mb-2">
            <Calendar size={9} style={{ color: overdue ? "var(--error)" : "var(--text-muted)", flexShrink: 0 }} />
            <span
              className="text-[9px] font-medium"
              style={{ color: overdue ? "var(--error)" : "var(--text-muted)" }}
            >
              {formatDate(item.scheduledDate)}
              {item.scheduledTime && <span style={{ marginLeft: 4 }}>· {item.scheduledTime}</span>}
            </span>
            {overdue && (
              <span
                className="text-[8px] font-bold px-1 py-0.5 rounded ml-1"
                style={{ background: "var(--error)20", color: "var(--error)" }}
              >
                OVERDUE
              </span>
            )}
          </div>
        )}

        {/* Footer row: attachments + comments + assignee */}
        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2.5">
            {item.attachments?.length > 0 && (
              <div className="flex items-center gap-0.5">
                <Paperclip size={9} style={{ color: "var(--text-muted)" }} />
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                  {item.attachments.length}
                </span>
              </div>
            )}
            {item.comments?.length > 0 && (
              <div className="flex items-center gap-0.5">
                <MessageSquare size={9} style={{ color: "var(--text-muted)" }} />
                <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                  {item.comments.length}
                </span>
              </div>
            )}
            {readiness !== "not_ready" && (
              <PublishingReadinessBadge readiness={readiness} size="sm" />
            )}
          </div>

          {/* Assignee avatar */}
          {assignee ? (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
              style={{ background: assignee.color || "var(--accent)" }}
              title={assignee.name}
            >
              {assignee.initials || assignee.name.slice(0, 2).toUpperCase()}
            </div>
          ) : item.assignedTo ? (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
              style={{ background: "var(--accent)" }}
            >
              {item.assignedTo.slice(0, 2).toUpperCase()}
            </div>
          ) : null}
        </div>
      </div>
      </motion.div>
    </div>
  );
}
