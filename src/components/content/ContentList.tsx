"use client";

import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import {
  PLATFORM_COLORS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  APPROVAL_COLORS,
  formatDate,
} from "./contentUtils";
import { useLanguage } from "@/lib/LanguageContext";
import { useAppStore } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";

type SortField = "title" | "scheduledDate" | "status" | "priority" | "platform";
type SortDir = "asc" | "desc";

interface ContentListProps {
  items: ContentItem[];
  onItemClick: (item: ContentItem) => void;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown size={11} style={{ opacity: 0.4 }} />;
  return sortDir === "asc"
    ? <ArrowUp size={11} style={{ color: "var(--accent)" }} />
    : <ArrowDown size={11} style={{ color: "var(--accent)" }} />;
}

export function ContentList({ items, onItemClick }: ContentListProps) {
  const { t } = useLanguage();
  const { clients, members } = useAppStore();
  const { deleteContentItem } = useContentItems();

  const [sortField, setSortField] = useState<SortField>("scheduledDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      let av: string = "";
      let bv: string = "";
      if (sortField === "title") { av = a.title; bv = b.title; }
      else if (sortField === "scheduledDate") { av = a.scheduledDate || ""; bv = b.scheduledDate || ""; }
      else if (sortField === "status") { av = a.status; bv = b.status; }
      else if (sortField === "priority") {
        const order = { high: 0, medium: 1, low: 2 };
        return sortDir === "asc" ? order[a.priority] - order[b.priority] : order[b.priority] - order[a.priority];
      }
      else if (sortField === "platform") { av = a.platform; bv = b.platform; }
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, sortField, sortDir]);

  const allSelected = sorted.length > 0 && selected.size === sorted.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((i) => i.id)));
  };

  const handleBulkDelete = async () => {
    for (const id of selected) {
      await deleteContentItem(id);
    }
    setSelected(new Set());
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
    borderBottom: "1px solid var(--border)",
    background: "var(--surface-1)",
    cursor: "pointer",
    userSelect: "none" as const,
  };

  const tdStyle: React.CSSProperties = {
    padding: "10px 12px",
    fontSize: "12px",
    color: "var(--text-primary)",
    verticalAlign: "middle" as const,
    borderBottom: "1px solid var(--border)",
  };

  return (
    <div>
      {/* Bulk actions */}
      {selected.size > 0 && (
        <div
          className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {selected.size} selected
          </span>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
            style={{ color: "var(--error)", background: "var(--surface-3)" }}
          >
            <Trash2 size={11} />
            Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "36px", cursor: "default" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                  />
                </th>
                {(["title", "platform", "status", "scheduledDate", "priority"] as SortField[]).map((field) => {
                  const labelMap: Record<SortField, string> = {
                    title: t("content.colTitle"),
                    platform: t("content.colPlatform"),
                    status: t("content.colStatus"),
                    scheduledDate: t("content.colScheduled"),
                    priority: t("content.colPriority"),
                  };
                  return (
                    <th key={field} style={thStyle} onClick={() => toggleSort(field)}>
                      <div className="flex items-center gap-1">
                        {labelMap[field]}
                        <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
                      </div>
                    </th>
                  );
                })}
                <th style={{ ...thStyle, cursor: "default" }}>{t("content.colClient")}</th>
                <th style={{ ...thStyle, cursor: "default" }}>{t("content.colAssignee")}</th>
                <th style={{ ...thStyle, cursor: "default" }}>{t("content.colApproval")}</th>
                <th style={{ ...thStyle, cursor: "default", width: "60px" }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => {
                const client = clients.find((c) => c.id === item.clientId);
                const assignee = members.find((m) => m.id === item.assignedTo);
                const isSelected = selected.has(item.id);

                return (
                  <tr
                    key={item.id}
                    style={{
                      background: isSelected ? "var(--accent-dim)" : "var(--surface-1)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--surface-1)";
                    }}
                    onClick={() => onItemClick(item)}
                  >
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const s = new Set(selected);
                          if (isSelected) s.delete(item.id);
                          else s.add(item.id);
                          setSelected(s);
                        }}
                        style={{ cursor: "pointer", accentColor: "var(--accent)" }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                        {item.title}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                          background: PLATFORM_COLORS[item.platform] + "22",
                          color: PLATFORM_COLORS[item.platform],
                        }}
                      >
                        {item.platform}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md capitalize"
                        style={{
                          background: STATUS_COLORS[item.status] + "22",
                          color: STATUS_COLORS[item.status],
                        }}
                      >
                        {t(("content.status" + item.status.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")) as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>
                        {formatDate(item.scheduledDate)}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md capitalize"
                        style={{
                          background: PRIORITY_COLORS[item.priority] + "22",
                          color: PRIORITY_COLORS[item.priority],
                        }}
                      >
                        {t(("content.priority" + item.priority.charAt(0).toUpperCase() + item.priority.slice(1)) as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                        {client?.name ?? "—"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {assignee ? (
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                            style={{ background: "var(--accent)" }}
                          >
                            {assignee.initials || assignee.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                            {assignee.name}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>—</span>
                      )}
                    </td>
                    <td style={tdStyle}>
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{
                          background: APPROVAL_COLORS[item.approvalStatus] + "22",
                          color: APPROVAL_COLORS[item.approvalStatus],
                        }}
                      >
                        {t(("content.approval" + item.approvalStatus.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")) as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onItemClick(item)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => deleteContentItem(item.id)}
                          className="w-6 h-6 rounded-lg flex items-center justify-center transition-all"
                          style={{ color: "var(--text-muted)" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--error)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
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
