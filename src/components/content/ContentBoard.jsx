"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { STATUS_ORDER, STATUS_LABELS, STATUS_COLORS } from "./contentUtils";
import { ContentCard } from "./ContentCard";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";







// Column background gradient by status — very subtle
const COLUMN_BG = {
  idea: "linear-gradient(180deg, rgba(136,136,160,0.06) 0%, transparent 100%)",
  draft: "linear-gradient(180deg, rgba(136,136,160,0.06) 0%, transparent 100%)",
  copywriting: "linear-gradient(180deg, rgba(79,142,247,0.07) 0%, transparent 100%)",
  design: "linear-gradient(180deg, rgba(167,139,250,0.07) 0%, transparent 100%)",
  in_progress: "linear-gradient(180deg, rgba(79,142,247,0.07) 0%, transparent 100%)",
  internal_review: "linear-gradient(180deg, rgba(251,191,36,0.07) 0%, transparent 100%)",
  client_review: "linear-gradient(180deg, rgba(249,115,22,0.07) 0%, transparent 100%)",
  approved: "linear-gradient(180deg, rgba(52,211,153,0.07) 0%, transparent 100%)",
  scheduled: "linear-gradient(180deg, rgba(6,182,212,0.07) 0%, transparent 100%)",
  publishing_ready: "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, transparent 100%)",
  published: "linear-gradient(180deg, rgba(16,185,129,0.08) 0%, transparent 100%)",
  failed: "linear-gradient(180deg, rgba(248,113,113,0.07) 0%, transparent 100%)",
  archived: "linear-gradient(180deg, rgba(136,136,160,0.05) 0%, transparent 100%)"
};

// ── Single column ──────────────────────────────────────────────

function ContentColumn({
  status,
  items,
  onCardClick,
  onNewInColumn,
  onDrop,
  isDragOver,
  onDragOver,
  onDragLeave,
  onCardDragStart










}) {
  const { t } = useLanguage();
  const labelKey = STATUS_LABELS[status];
  const color = STATUS_COLORS[status];

  return (
    <div
      className="flex flex-col flex-shrink-0 rounded-2xl overflow-hidden"
      style={{
        width: "240px",
        minWidth: "240px",
        background: isDragOver ?
        `var(--surface-3)` :
        `var(--surface-1)`,
        backgroundImage: isDragOver ? undefined : COLUMN_BG[status],
        border: `1px solid ${isDragOver ? color + "80" : "var(--border)"}`,
        boxShadow: isDragOver ? `0 0 0 2px ${color}30, 0 4px 20px rgba(0,0,0,0.1)` : "none",
        transition: "border-color 0.15s, box-shadow 0.15s, background 0.15s",
        minHeight: "300px",
        maxHeight: "calc(100vh - 260px)"
      }}
      onDragOver={(e) => {e.preventDefault();onDragOver(e);}}
      onDrop={() => onDrop(status)}
      onDragLeave={onDragLeave}>
      
      {/* Column header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${color}30` }}>
        
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: color, boxShadow: `0 0 6px ${color}60` }} />
          
          <span
            className="text-xs font-semibold truncate"
            style={{ color: "var(--text-primary)" }}>
            
            {t(labelKey)}
          </span>
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{
              background: color + "20",
              color: color,
              border: `1px solid ${color}35`
            }}>
            
            {items.length}
          </span>
        </div>
        {onNewInColumn &&
        <button
          onClick={() => onNewInColumn(status)}
          className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
          style={{ color: "var(--text-muted)", background: "transparent" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = color + "20";
            e.currentTarget.style.color = color;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          title={`Add to ${t(labelKey)}`}>
          
            <Plus size={13} />
          </button>
        }
      </div>

      {/* Cards (scrollable) */}
      <div className="flex flex-col gap-2 p-2.5 overflow-y-auto flex-1">
        <AnimatePresence>
          {items.map((item, i) =>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, delay: i * 0.03 }}>
            
              <ContentCard
              item={item}
              onClick={() => onCardClick(item)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("contentItemId", item.id);
                e.dataTransfer.effectAllowed = "move";
                onCardDragStart(item.id);
              }} />
            
            </motion.div>
          )}
        </AnimatePresence>

        {items.length === 0 &&
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-xl gap-2"
          style={{
            minHeight: "80px",
            border: `1.5px dashed ${color}40`,
            color: "var(--text-muted)",
            fontSize: "11px"
          }}>
          
            <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: color + "15" }}>
            
              <Plus size={12} style={{ color }} />
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>Drop here</span>
          </motion.div>
        }
      </div>
    </div>);

}

// ── Board ──────────────────────────────────────────────────────

export function ContentBoard({ items, onCardClick, onNewInColumn }) {
  const { updateContentItem } = useContentItems();
  const { isRTL } = useLanguage();
  const [dragOverStatus, setDragOverStatus] = useState(null);
  const dragItemId = useRef(null);

  const grouped = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = items.filter((i) => i.status === s);
      return acc;
    },
    {}
  );

  const handleDrop = async (targetStatus) => {
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
      style={{ direction: isRTL ? "rtl" : "ltr" }}>
      
      {columns.map((status) =>
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
        onCardDragStart={(id) => {dragItemId.current = id;}} />

      )}
    </div>);

}