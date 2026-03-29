"use client";

import { useState, useMemo } from "react";
import { Plus, Kanban, CalendarDays, List, Search, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ContentBoard } from "@/components/content/ContentBoard";
import { ContentCalendar } from "@/components/content/ContentCalendar";
import { ContentList } from "@/components/content/ContentList";
import { ContentModal } from "@/components/content/ContentModal";
import { ContentFilters, EMPTY_FILTERS, applyFilters, type ContentFiltersState } from "@/components/content/ContentFilters";
import type { ContentItem, ContentStatus } from "@/lib/types";

type ViewMode = "board" | "calendar" | "list";

// Skeleton card for loading state
function SkeletonCard() {
  return (
    <div
      className="rounded-xl p-3 animate-pulse"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", height: 110 }}
    >
      <div className="flex gap-2 mb-3">
        <div className="h-4 w-16 rounded-md" style={{ background: "var(--surface-3)" }} />
        <div className="h-4 w-12 rounded-md" style={{ background: "var(--surface-3)" }} />
      </div>
      <div className="h-3 w-full rounded mb-1.5" style={{ background: "var(--surface-3)" }} />
      <div className="h-3 w-3/4 rounded mb-3" style={{ background: "var(--surface-3)" }} />
      <div className="h-2.5 w-20 rounded" style={{ background: "var(--surface-3)" }} />
    </div>
  );
}

export default function ContentPage() {
  const { contentItems, loading } = useContentItems();
  const { t } = useLanguage();

  const [view, setView] = useState<ViewMode>("board");
  const [filters, setFilters] = useState<ContentFiltersState>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ContentItem | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<ContentStatus | undefined>(undefined);
  const [searchFocused, setSearchFocused] = useState(false);

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

  const viewOptions: { id: ViewMode; icon: React.ReactNode; label: string }[] = [
    { id: "board", icon: <Kanban size={13} />, label: t("content.board") },
    { id: "calendar", icon: <CalendarDays size={13} />, label: t("content.calendar") },
    { id: "list", icon: <List size={13} />, label: t("content.list") },
  ];

  return (
    <div className="space-y-5">
      {/* Premium page header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start justify-between flex-wrap gap-3"
      >
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {t("content.title")}
            </h1>
            {!loading && contentItems.length > 0 && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                style={{
                  background: "var(--accent)18",
                  color: "var(--accent)",
                  border: "1px solid var(--accent)30",
                }}
              >
                {contentItems.length}
              </motion.span>
            )}
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {filteredItems.length !== contentItems.length
              ? `${filteredItems.length} of ${contentItems.length} items`
              : `${contentItems.length} ${contentItems.length === 1 ? "item" : "items"}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View switcher — premium pill */}
          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
          >
            {viewOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setView(opt.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: view === opt.id ? "var(--surface-1)" : "transparent",
                  color: view === opt.id ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: view === opt.id ? "0 1px 4px rgba(0,0,0,0.12)" : "none",
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>

          {/* New content button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{
              background: "var(--accent)",
              color: "white",
              boxShadow: "0 2px 8px var(--accent)40",
            }}
          >
            <Plus size={15} />
            {t("content.newContent")}
          </motion.button>
        </div>
      </motion.div>

      {/* Search + filters bar */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: 0.05 }}
        className="flex items-start gap-3 flex-wrap"
      >
        {/* Search with icon */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: searchFocused ? "var(--accent)" : "var(--text-muted)", transition: "color 0.15s" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={t("content.searchPlaceholder")}
            className="rounded-xl pl-9 pr-3 py-2 text-sm outline-none transition-all"
            style={{
              background: "var(--surface-2)",
              border: `1px solid ${searchFocused ? "var(--accent)60" : "var(--border)"}`,
              color: "var(--text-primary)",
              width: "240px",
              boxShadow: searchFocused ? "0 0 0 3px var(--accent)15" : "none",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full"
              style={{ color: "var(--text-muted)", background: "var(--surface-3)", fontSize: 10 }}
            >
              ×
            </button>
          )}
        </div>
        <ContentFilters filters={filters} onChange={setFilters} />
      </motion.div>

      {/* Loading skeleton */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Views */}
      <AnimatePresence mode="wait">
        {!loading && view === "board" && (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ContentBoard items={filteredItems} onCardClick={openEdit} onNewInColumn={openCreate} />
          </motion.div>
        )}

        {!loading && view === "calendar" && (
          <motion.div
            key="calendar"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl p-5"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
          >
            <ContentCalendar items={filteredItems} onItemClick={openEdit} />
          </motion.div>
        )}

        {!loading && view === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <ContentList items={filteredItems} onItemClick={openEdit} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence>
        {!loading && contentItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, var(--accent)20, var(--surface-3))",
                border: "1px solid var(--border)",
              }}
            >
              <Sparkles size={28} style={{ color: "var(--accent)" }} />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                {t("content.noItemsTitle")}
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {t("content.noItemsDesc")}
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => openCreate()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--accent)", color: "white", boxShadow: "0 2px 12px var(--accent)40" }}
            >
              <Plus size={15} />
              {t("content.newContent")}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

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
