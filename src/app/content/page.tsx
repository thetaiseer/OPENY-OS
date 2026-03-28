"use client";

import { useState, useMemo } from "react";
import { Plus, Kanban, CalendarDays, List, Loader2 } from "lucide-react";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ContentBoard } from "@/components/content/ContentBoard";
import { ContentCalendar } from "@/components/content/ContentCalendar";
import { ContentList } from "@/components/content/ContentList";
import { ContentModal } from "@/components/content/ContentModal";
import { ContentFilters, EMPTY_FILTERS, applyFilters, type ContentFiltersState } from "@/components/content/ContentFilters";
import type { ContentItem, ContentStatus } from "@/lib/types";

type ViewMode = "board" | "calendar" | "list";

export default function ContentPage() {
  const { contentItems, loading } = useContentItems();
  const { t } = useLanguage();

  const [view, setView] = useState<ViewMode>("board");
  const [filters, setFilters] = useState<ContentFiltersState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<ContentStatus | undefined>(undefined);

  const openCreate = (status?: ContentStatus) => {
    setEditItem(null);
    setDefaultStatus(status);
    setModalOpen(true);
  };

  const openEdit = (item: ContentItem) => {
    setEditItem(item);
    setDefaultStatus(undefined);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditItem(null);
    setDefaultStatus(undefined);
  };

  // Apply search + filters
  const filteredItems = useMemo(() => {
    let items = applyFilters(contentItems, filters);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.caption?.toLowerCase().includes(q) ||
          i.platform.toLowerCase().includes(q),
      );
    }
    return items;
  }, [contentItems, filters, search]);

  const viewBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px",
    borderRadius: "10px",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    background: active ? "var(--surface-1)" : "transparent",
    color: active ? "var(--text-primary)" : "var(--text-muted)",
    border: "none",
    outline: "none",
    transition: "all 0.15s",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  });

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {t("content.title")}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {contentItems.length} {contentItems.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View switcher */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
            <button style={viewBtnStyle(view === "board")} onClick={() => setView("board")}>
              <Kanban size={13} />
              {t("content.board")}
            </button>
            <button style={viewBtnStyle(view === "calendar")} onClick={() => setView("calendar")}>
              <CalendarDays size={13} />
              {t("content.calendar")}
            </button>
            <button style={viewBtnStyle(view === "list")} onClick={() => setView("list")}>
              <List size={13} />
              {t("content.list")}
            </button>
          </div>

          {/* New content button */}
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "var(--accent)", color: "white" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.9"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
          >
            <Plus size={15} />
            {t("content.newContent")}
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-start gap-3 flex-wrap">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("content.searchPlaceholder")}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              width: "220px",
            }}
          />
        </div>
        <ContentFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      )}

      {/* Views */}
      {!loading && view === "board" && (
        <ContentBoard
          items={filteredItems}
          onCardClick={openEdit}
          onNewInColumn={openCreate}
        />
      )}

      {!loading && view === "calendar" && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        >
          <ContentCalendar items={filteredItems} onItemClick={openEdit} />
        </div>
      )}

      {!loading && view === "list" && (
        <ContentList items={filteredItems} onItemClick={openEdit} />
      )}

      {/* Empty state */}
      {!loading && contentItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "var(--surface-2)" }}
          >
            <CalendarDays size={24} style={{ color: "var(--text-muted)" }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("content.noItemsTitle")}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {t("content.noItemsDesc")}
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Plus size={14} />
            {t("content.newContent")}
          </button>
        </div>
      )}

      {/* Modal */}
      <ContentModal
        open={modalOpen}
        onClose={closeModal}
        item={editItem}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}
