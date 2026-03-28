"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { ContentItem, ContentStatus } from "@/lib/types";
import { STATUS_ORDER, STATUS_LABELS, STATUS_COLORS } from "./contentUtils";
import { ContentCard } from "./ContentCard";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";

interface ContentBoardProps {
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
  onNewInColumn?: (status: ContentStatus) => void;
}

// ── Single column ─────────────────────────────────────────────

function ContentColumn({
  status,
  items,
  onCardClick,
  onNewInColumn,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onCardDragStart,
}: {
  status: ContentStatus;
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
  onNewInColumn?: (status: ContentStatus) => void;
  onDrop: (status: ContentStatus) => void;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onCardDragStart: (itemId: string) => void;
}) {
  const { t } = useLanguage();
  const labelKey = STATUS_LABELS[status] as Parameters<typeof t>[0];
  const color = STATUS_COLORS[status];

  return (
    <div
      className="flex flex-col flex-shrink-0 rounded-2xl overflow-hidden"
      style={{
        width: "220px",
        background: isDragOver ? "var(--surface-3)" : "var(--surface-1)",
        border: `1px solid ${isDragOver ? color + "55" : "var(--border)"}`,
        transition: "border-color 0.15s, background 0.15s",
        minHeight: "200px",
      }}
      onDragOver={(e) => { e.preventDefault(); onDragOver(e); }}
      onDrop={() => onDrop(status)}
      onDragLeave={onDragLeave}
    >
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
          <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
            {t(labelKey)}
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
          >
            {items.length}
          </span>
        </div>
        {onNewInColumn && (
          <button
            onClick={() => onNewInColumn(status)}
            className="w-5 h-5 rounded-lg flex items-center justify-center transition-all"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 flex-1">
        {items.map((item) => (
          <ContentCard
            key={item.id}
            item={item}
            onClick={() => onCardClick(item)}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("contentItemId", item.id);
              e.dataTransfer.effectAllowed = "move";
              onCardDragStart(item.id);
            }}
          />
        ))}
        {items.length === 0 && (
          <div
            className="flex-1 flex items-center justify-center rounded-xl min-h-[80px]"
            style={{
              border: "1px dashed var(--border)",
              color: "var(--text-muted)",
              fontSize: "11px",
            }}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────

export function ContentBoard({ items, onCardClick, onNewInColumn }: ContentBoardProps) {
  const { updateContentItem } = useContentItems();
  const { isRTL } = useLanguage();
  const [dragOverStatus, setDragOverStatus] = useState<ContentStatus | null>(null);
  const dragItemId = useRef<string | null>(null);

  const grouped = STATUS_ORDER.reduce<Record<ContentStatus, ContentItem[]>>(
    (acc, s) => {
      acc[s] = items.filter((i) => i.status === s);
      return acc;
    },
    {} as Record<ContentStatus, ContentItem[]>,
  );

  const handleDrop = async (targetStatus: ContentStatus) => {
    const id = dragItemId.current;
    setDragOverStatus(null);
    dragItemId.current = null;
    if (!id) return;
    const item = items.find((i) => i.id === id);
    if (!item || item.status === targetStatus) return;
    await updateContentItem(id, { status: targetStatus });
  };

  const columns = isRTL ? [...STATUS_ORDER].reverse() : STATUS_ORDER;

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4"
      style={{ direction: isRTL ? "rtl" : "ltr" }}
    >
      {columns.map((status) => (
        <ContentColumn
          key={status}
          status={status}
          items={grouped[status]}
          onCardClick={onCardClick}
          onNewInColumn={onNewInColumn}
          isDragOver={dragOverStatus === status}
          onDragOver={() => setDragOverStatus(status)}
          onDragLeave={() => setDragOverStatus(null)}
          onDrop={handleDrop}
          onCardDragStart={(id) => { dragItemId.current = id; }}
        />
      ))}
    </div>
  );
}
