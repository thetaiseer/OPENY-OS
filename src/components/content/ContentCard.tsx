"use client";

import { Paperclip, MessageSquare, Calendar } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import {
  PLATFORM_COLORS,
  PLATFORM_EMOJIS,
  PRIORITY_COLORS,
  STATUS_COLORS,
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
  const { clients } = useAppStore();
  const client = clients.find((c) => c.id === item.clientId);
  const overdue = isOverdue(item.scheduledDate) && item.status !== "published";
  const readiness = computeReadiness(item);

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      className="group rounded-xl p-3 cursor-pointer select-none transition-all duration-150"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${PRIORITY_COLORS[item.priority]}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
        (e.currentTarget as HTMLElement).style.boxShadow = "";
      }}
    >
      {/* Title */}
      <p className="text-xs font-semibold mb-2 leading-snug line-clamp-2" style={{ color: "var(--text-primary)" }}>
        {item.title}
      </p>

      {/* Client */}
      {client && (
        <p className="text-[10px] mb-2 truncate" style={{ color: "var(--text-muted)" }}>
          {client.name}
        </p>
      )}

      {/* Platform badge */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
          style={{
            background: PLATFORM_COLORS[item.platform] + "22",
            color: PLATFORM_COLORS[item.platform],
            border: `1px solid ${PLATFORM_COLORS[item.platform]}44`,
          }}
        >
          {PLATFORM_EMOJIS[item.platform]} {item.platform}
        </span>
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-md capitalize"
          style={{
            background: "var(--surface-4)",
            color: "var(--text-secondary)",
          }}
        >
          {t(`content.type${item.contentType.charAt(0).toUpperCase()}${item.contentType.slice(1)}` as Parameters<typeof t>[0])}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2">
          {/* Scheduled date */}
          {item.scheduledDate && (
            <div className="flex items-center gap-1">
              <Calendar size={9} style={{ color: overdue ? "var(--error)" : "var(--text-muted)" }} />
              <span
                className="text-[9px]"
                style={{ color: overdue ? "var(--error)" : "var(--text-muted)" }}
              >
                {formatDate(item.scheduledDate)}
              </span>
            </div>
          )}
          {/* Attachments */}
          {item.attachments?.length > 0 && (
            <div className="flex items-center gap-0.5">
              <Paperclip size={9} style={{ color: "var(--text-muted)" }} />
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                {item.attachments.length}
              </span>
            </div>
          )}
          {/* Comments */}
          {item.comments?.length > 0 && (
            <div className="flex items-center gap-0.5">
              <MessageSquare size={9} style={{ color: "var(--text-muted)" }} />
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                {item.comments.length}
              </span>
            </div>
          )}
        </div>

        {/* Assignee initial */}
        {item.assignedTo && (
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
            style={{ background: "var(--accent)" }}
          >
            {item.assignedTo.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Status dot + Readiness */}
      <div className="flex items-center justify-between gap-1 mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center gap-1">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: STATUS_COLORS[item.status] }}
          />
          <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
            {t(("content.status" + item.status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")) as Parameters<typeof t>[0])}
          </span>
        </div>
        {readiness !== "not_ready" && (
          <PublishingReadinessBadge readiness={readiness} size="sm" />
        )}
      </div>
    </div>
  );
}
