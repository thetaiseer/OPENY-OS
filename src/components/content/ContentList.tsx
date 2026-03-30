"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ContentItem } from "@/lib/types";
import {
  PLATFORM_COLORS,
  PLATFORM_EMOJIS,
  STATUS_COLORS,
  STATUS_LABELS,
  PRIORITY_COLORS,
  APPROVAL_COLORS,
  APPROVAL_LABELS,
  formatDate,
} from "./contentUtils";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useToast } from "@/lib/ToastContext";

type SortField = "title" | "scheduledDate" | "status" | "priority" | "platform";
type SortDir = "asc" | "desc";

interface ContentListProps {
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
}

function SortBtn({
  field,
  sortField,
  sortDir,
  label,
  onSort,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
  label: string;
  onSort: (f: SortField) => void;
}) {
  const active = field === sortField;
  return (
    <button
      className="flex items-center gap-1 group select-none"
      onClick={() => onSort(field)}
    >
      <span style={{ color: active ? "var(--accent)" : "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ color: active ? "var(--accent)" : "var(--text-muted)", opacity: active ? 1 : 0.4 }}>
        {active ? (
          sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
        ) : (
          <ArrowUpDown size={11} />
        )}
      </span>
    </button>
  );
}

export function ContentList({ items, onItemClick }: ContentListProps) {
  const { t } = useLanguage();
  const { clients, members } = useAppStore();
  const { deleteContentItem } = useContentItems();
  const { showToast } = useToast();

  const [sortField, setSortField] = useState<SortField>("scheduledDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortField === "priority") {
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
        return sortDir === "asc"
          ? order[a.priority] - order[b.priority]
          : order[b.priority] - order[a.priority];
      }
      const fieldMap: Record<SortField, string> = {
        title: a.title,
        scheduledDate: a.scheduledDate || "",
        status: a.status,
        platform: a.platform,
        priority: a.priority,
      };
      const bFieldMap: Record<SortField, string> = {
        title: b.title,
        scheduledDate: b.scheduledDate || "",
        status: b.status,
        platform: b.platform,
        priority: b.priority,
      };
      const cmp = fieldMap[sortField].localeCompare(bFieldMap[sortField]);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortField, sortDir]);

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(sorted.map((i) => i.id)));
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteContentItem(id);
      setSelected((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Failed to delete content: ${msg}`, "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    setSelected(new Set());
    const results = await Promise.allSettled(ids.map((id) => deleteContentItem(id)));
    results.forEach((r) => {
      if (r.status === "rejected") {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        showToast(`Failed to delete item: ${msg}`, "error");
      }
    });
  };

  const thCls = "px-3 py-3 text-left whitespace-nowrap select-none";
  const tdCls = "px-3 py-3 align-middle";

  return (
    <div className="space-y-3">
      {/* Bulk actions bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
            style={{
              background: "var(--accent-dim)",
              border: "1px solid var(--accent)40",
            }}
          >
            <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
              {selected.size} selected
            </span>
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
              style={{ color: "var(--error)", background: "var(--error)15", border: "1px solid var(--error)30" }}
            >
              <Trash2 size={11} />
              Delete selected
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="ml-auto text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                <th className={thCls} style={{ width: 40, paddingLeft: 16 }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </th>
                <th className={thCls}>
                  <SortBtn field="title" sortField={sortField} sortDir={sortDir} label={t("content.colTitle")} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortBtn field="platform" sortField={sortField} sortDir={sortDir} label={t("content.colPlatform")} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortBtn field="status" sortField={sortField} sortDir={sortDir} label={t("content.colStatus")} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortBtn field="scheduledDate" sortField={sortField} sortDir={sortDir} label={t("content.colScheduled")} onSort={toggleSort} />
                </th>
                <th className={thCls}>
                  <SortBtn field="priority" sortField={sortField} sortDir={sortDir} label={t("content.colPriority")} onSort={toggleSort} />
                </th>
                <th className={thCls} style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>
                  {t("content.colClient")}
                </th>
                <th className={thCls} style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>
                  {t("content.colAssignee")}
                </th>
                <th className={thCls} style={{ color: "var(--text-muted)", fontSize: "11px", fontWeight: 600 }}>
                  {t("content.colApproval")}
                </th>
                <th className={thCls} style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {sorted.map((item, idx) => {
                  const client = clients.find((c) => c.id === item.clientId);
                  const assignee = members.find((m) => m.id === item.assignedTo);
                  const isSelected = selected.has(item.id);
                  const platformColor = PLATFORM_COLORS[item.platform];
                  const statusColor = STATUS_COLORS[item.status];
                  const isDeleting = deletingId === item.id;

                  return (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: isDeleting ? 0.4 : 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.12, delay: idx * 0.02 }}
                      style={{
                        background: isSelected ? "var(--accent-dim)" : idx % 2 === 0 ? "var(--surface-1)" : "var(--surface-1)",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        borderLeft: `3px solid ${statusColor}`,
                      }}
                      onClick={() => onItemClick(item)}
                      onMouseEnter={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-1)";
                      }}
                    >
                      {/* Checkbox */}
                      <td
                        className={tdCls}
                        style={{ paddingLeft: 16, borderLeft: "none" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const s = new Set(selected);
                            isSelected ? s.delete(item.id) : s.add(item.id);
                            setSelected(s);
                          }}
                          style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                        />
                      </td>

                      {/* Title */}
                      <td className={tdCls} style={{ maxWidth: 240 }}>
                        <p
                          className="font-semibold truncate"
                          style={{ color: "var(--text-primary)", fontSize: "12px" }}
                        >
                          {item.title}
                        </p>
                        {item.caption && (
                          <p
                            className="truncate mt-0.5"
                            style={{ color: "var(--text-muted)", fontSize: "10px" }}
                            aria-label="Post caption"
                          >
                            {item.caption}
                          </p>
                        )}
                      </td>

                      {/* Platform */}
                      <td className={tdCls}>
                        <span
                          className="inline-flex items-center gap-1 font-bold rounded-md px-1.5 py-0.5"
                          style={{
                            background: platformColor + "18",
                            color: platformColor,
                            border: `1px solid ${platformColor}30`,
                            fontSize: "10px",
                          }}
                        >
                          <span style={{ fontSize: "9px" }}>{PLATFORM_EMOJIS[item.platform]}</span>
                          {item.platform}
                        </span>
                      </td>

                      {/* Status */}
                      <td className={tdCls}>
                        <span
                          className="inline-flex items-center gap-1 font-semibold rounded-full px-2 py-0.5"
                          style={{
                            background: statusColor + "18",
                            color: statusColor,
                            border: `1px solid ${statusColor}30`,
                            fontSize: "10px",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: statusColor }}
                          />
                          {t(STATUS_LABELS[item.status] as Parameters<typeof t>[0])}
                        </span>
                      </td>

                      {/* Scheduled date */}
                      <td className={tdCls}>
                        <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                          {formatDate(item.scheduledDate) || "—"}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className={tdCls}>
                        <span
                          className="inline-flex items-center font-semibold rounded-md px-1.5 py-0.5 capitalize"
                          style={{
                            background: PRIORITY_COLORS[item.priority] + "18",
                            color: PRIORITY_COLORS[item.priority],
                            fontSize: "10px",
                          }}
                        >
                          {item.priority}
                        </span>
                      </td>

                      {/* Client */}
                      <td className={tdCls}>
                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                          {client?.name ?? "—"}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className={tdCls}>
                        {assignee ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                              style={{ background: assignee.color || "var(--accent)" }}
                              title={assignee.name}
                            >
                              {assignee.initials || assignee.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                              {assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>—</span>
                        )}
                      </td>

                      {/* Approval */}
                      <td className={tdCls}>
                        <span
                          className="inline-flex font-medium rounded-md px-1.5 py-0.5"
                          style={{
                            background: APPROVAL_COLORS[item.approvalStatus] + "18",
                            color: APPROVAL_COLORS[item.approvalStatus],
                            fontSize: "10px",
                          }}
                        >
                          {t(APPROVAL_LABELS[item.approvalStatus] as Parameters<typeof t>[0])}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className={tdCls} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => onItemClick(item)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: "var(--text-muted)", background: "transparent" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "var(--accent)15";
                              (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                            }}
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            disabled={isDeleting}
                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: "var(--text-muted)", background: "transparent" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "var(--error)15";
                              (e.currentTarget as HTMLElement).style.color = "var(--error)";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                            }}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>

              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: "48px 24px",
                      textAlign: "center",
                      color: "var(--text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    {t("content.noItemsTitle")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
