"use client";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  CheckSquare, Plus, Circle, CheckCircle2, Clock, Trash2,
  ChevronDown, Loader2, User, ArrowUpDown, ChevronUp, ChevronRight,
  Calendar as CalendarIcon, LayoutGrid, List, Target, X, Pencil,
  Flag, AlertCircle, Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useTasks, useTeam, useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Task, TeamMember, Client } from "@/lib/types";

type View = "my" | "kanban" | "table";
type Priority = Task["priority"];
type Status = Task["status"];
type SortField = "title" | "status" | "priority" | "dueDate" | "assignee";
type SortDir = "asc" | "desc";

const PRIORITY_COLORS: Record<Priority, "red" | "yellow" | "blue"> = {
  high: "red", medium: "yellow", low: "blue",
};
const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
const PRIORITY_BORDER: Record<Priority, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#60a5fa",
};
const PRIORITY_BG: Record<Priority, string> = {
  high: "rgba(248,113,113,0.10)",
  medium: "rgba(251,191,36,0.10)",
  low: "rgba(96,165,250,0.10)",
};
const PRIORITY_ICON: Record<Priority, React.ElementType> = {
  high: AlertCircle,
  medium: Minus,
  low: ChevronDown,
};
const STATUS_LABELS: Record<Status, string> = {
  todo: "To Do",
  "in-progress": "In Progress",
  done: "Done",
};
const STATUS_COLORS: Record<Status, string> = {
  todo: "#8888a0",
  "in-progress": "#4f8ef7",
  done: "#34d399",
};

// ── Assignee Select ──────────────────────────────────────────
interface AssigneeSelectProps {
  members: TeamMember[];
  loading: boolean;
  value: string;
  onChange: (id: string, name: string) => void;
  label?: string;
}
function AssigneeSelect({ members, loading, value, onChange, label }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const activeMembers = members.filter(m => m.status === "active");
  const filtered = activeMembers.filter(
    m => m.name.toLowerCase().includes(search.toLowerCase()) || m.role.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = members.find(m => m.id === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      {label && <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>}
      <button
        type="button"
        onClick={() => !loading && setOpen(v => !v)}
        className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-start flex items-center justify-between gap-2"
        style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {loading ? (
          <span className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={13} className="animate-spin" /> Loading…
          </span>
        ) : selected ? (
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: selected.color }}>{selected.initials}</span>
            <span>{selected.name}</span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {selected.role}</span>
          </span>
        ) : <span>Unassigned</span>}
        <ChevronDown size={14} style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div className="absolute z-50 rounded-2xl shadow-xl overflow-hidden top-full mt-1 w-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <input autoFocus placeholder="Search members…" value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm px-2 py-1 outline-none" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            <button type="button" onClick={() => { onChange("", "Unassigned"); setOpen(false); setSearch(""); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-3)", border: "1px dashed var(--border)" }}>
                <User size={12} style={{ color: "var(--text-muted)" }} />
              </div>
              Unassigned
            </button>
            {filtered.length === 0
              ? <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>No results</p>
              : filtered.map(m => (
                <button key={m.id} type="button" onClick={() => { onChange(m.id, m.name); setOpen(false); setSearch(""); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start transition-colors"
                  style={{ background: value === m.id ? "var(--accent-dim)" : "" }}
                  onMouseEnter={e => { if (value !== m.id) e.currentTarget.style.background = "var(--surface-3)"; }}
                  onMouseLeave={e => { if (value !== m.id) e.currentTarget.style.background = ""; }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: m.color }}>{m.initials}</div>
                  <div className="min-w-0">
                    <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>{m.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.role}</div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function getAssigneeName(task: Task, members: TeamMember[]): string {
  if (task.assigneeId) {
    const m = members.find(m => m.id === task.assigneeId);
    if (m) return m.name;
  }
  return task.assigneeName || task.assignee || "Unassigned";
}
function getAssigneeInitials(task: Task, members: TeamMember[]): string {
  if (task.assigneeId) {
    const m = members.find(m => m.id === task.assigneeId);
    if (m) return m.initials;
  }
  const name = task.assigneeName || task.assignee || "";
  return name ? name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "?";
}
function getAssigneeColor(task: Task, members: TeamMember[]): string {
  if (task.assigneeId) {
    const m = members.find(m => m.id === task.assigneeId);
    if (m) return m.color;
  }
  return "#8888a0";
}

// ── Detail Side Panel ────────────────────────────────────────
interface DetailPanelProps {
  task: Task;
  members: TeamMember[];
  clients: Client[];
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Omit<Task, "id">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggleDone: (id: string) => Promise<void>;
  membersLoading: boolean;
}
function DetailPanel({ task, members, clients, onClose, onUpdate, onDelete, onToggleDone, membersLoading }: DetailPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTitle(task.title); }, [task.title]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);

  const handleTitleBlur = async () => {
    setEditingTitle(false);
    if (title.trim() && title.trim() !== task.title) {
      await onUpdate(task.id, { title: title.trim() });
    }
  };

  const client = clients.find(c => c.id === task.clientId);
  const assigneeName = getAssigneeName(task, members);
  const assigneeInitials = getAssigneeInitials(task, members);
  const assigneeColor = getAssigneeColor(task, members);

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 26, stiffness: 260 }}
      className="fixed right-0 top-0 h-full z-50 flex flex-col"
      style={{
        width: "min(92vw, 420px)",
        background: "var(--surface-1)",
        borderLeft: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggleDone(task.id)}
            className="flex-shrink-0 transition-transform hover:scale-110"
            title="Toggle completion"
          >
            {task.status === "done"
              ? <CheckCircle2 size={20} style={{ color: "#34d399" }} />
              : <Circle size={20} style={{ color: "var(--text-muted)" }} />}
          </button>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: PRIORITY_BG[task.priority], color: PRIORITY_BORDER[task.priority] }}>
            {task.priority}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ color: "var(--error)", background: "rgba(248,113,113,0.10)" }}
            title="Delete task"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Title */}
        <div>
          {editingTitle ? (
            <input
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={e => { if (e.key === "Enter") handleTitleBlur(); if (e.key === "Escape") { setEditingTitle(false); setTitle(task.title); } }}
              className="w-full text-lg font-bold bg-transparent outline-none border-b-2 pb-1"
              style={{ color: "var(--text-primary)", borderColor: "var(--accent)" }}
            />
          ) : (
            <div className="flex items-start gap-2 group cursor-pointer" onClick={() => setEditingTitle(true)}>
              <h2
                className={`text-lg font-bold flex-1 leading-snug ${task.status === "done" ? "line-through opacity-50" : ""}`}
                style={{ color: "var(--text-primary)" }}
              >
                {task.title}
              </h2>
              <Pencil size={13} className="mt-1 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />
            </div>
          )}
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</label>
          <div className="flex gap-2">
            {(["todo", "in-progress", "done"] as Status[]).map(s => (
              <button
                key={s}
                onClick={() => onUpdate(task.id, { status: s })}
                className="flex-1 py-2 text-xs font-medium rounded-xl transition-all"
                style={{
                  background: task.status === s ? "var(--accent-dim)" : "var(--surface-2)",
                  color: task.status === s ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${task.status === s ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Priority</label>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as Priority[]).map(p => (
              <button
                key={p}
                onClick={() => onUpdate(task.id, { priority: p })}
                className="flex-1 py-2 text-xs font-medium rounded-xl transition-all capitalize"
                style={{
                  background: task.priority === p ? PRIORITY_BG[p] : "var(--surface-2)",
                  color: task.priority === p ? PRIORITY_BORDER[p] : "var(--text-muted)",
                  border: `1px solid ${task.priority === p ? PRIORITY_BORDER[p] + "66" : "var(--border)"}`,
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Due Date</label>
          <div className="relative">
            <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              type="date"
              value={task.dueDate && task.dueDate !== "TBD" ? task.dueDate : ""}
              onChange={e => onUpdate(task.id, { dueDate: e.target.value || "TBD" })}
              className="glass-input w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Assignee */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Assignee</label>
          <AssigneeSelect
            members={members}
            loading={membersLoading}
            value={task.assigneeId ?? ""}
            onChange={(id, name) => onUpdate(task.id, { assigneeId: id || undefined, assigneeName: name, assignee: name })}
          />
        </div>

        {/* Client */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Client</label>
          <select
            value={task.clientId ?? ""}
            onChange={e => onUpdate(task.id, { clientId: e.target.value || undefined })}
            className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Meta */}
        <div className="pt-2 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Assignee</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: assigneeColor }}>{assigneeInitials}</div>
              <span style={{ color: "var(--text-secondary)" }}>{assigneeName}</span>
            </div>
          </div>
          {client && (
            <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
              <span>Client</span>
              <span className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: client.color }}>{client.initials}</div>
                <span style={{ color: "var(--text-secondary)" }}>{client.name}</span>
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-muted)" }}>
            <span>Created</span>
            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function TasksPage() {
  const { t } = useLanguage();
  const { tasks, addTask, updateTask, deleteTask, toggleTaskDone, openTaskCount } = useTasks();
  const { members } = useTeam();
  const { clients, loading: membersLoading } = useAppStore();

  const [view, setView] = useState<View>("my");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const defaultForm = { title: "", clientId: "", assigneeId: "", assigneeName: "", priority: "medium" as Priority, dueDate: "", status: "todo" as Status };
  const [form, setForm] = useState(defaultForm);

  const liveSelected = selectedTask ? tasks.find(t => t.id === selectedTask.id) ?? null : null;

  const sortedTable = useMemo(() => [...tasks].sort((a, b) => {
    let av: string | number = "", bv: string | number = "";
    if (sortField === "title") { av = a.title; bv = b.title; }
    else if (sortField === "status") { av = a.status; bv = b.status; }
    else if (sortField === "priority") { av = PRIORITY_WEIGHT[a.priority]; bv = PRIORITY_WEIGHT[b.priority]; }
    else if (sortField === "dueDate") { av = a.dueDate; bv = b.dueDate; }
    else if (sortField === "assignee") { av = getAssigneeName(a, members); bv = getAssigneeName(b, members); }
    if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [tasks, sortField, sortDir, members]);

  const tasksByPriority = useMemo(() => ({
    high: tasks.filter(t => t.priority === "high"),
    medium: tasks.filter(t => t.priority === "medium"),
    low: tasks.filter(t => t.priority === "low"),
  }), [tasks]);

  const tasksByStatus = useMemo(() => ({
    todo: tasks.filter(t => t.status === "todo"),
    "in-progress": tasks.filter(t => t.status === "in-progress"),
    done: tasks.filter(t => t.status === "done"),
  }), [tasks]);

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    await addTask({
      title: form.title.trim(),
      clientId: form.clientId || undefined,
      assigneeId: form.assigneeId || undefined,
      assigneeName: form.assigneeName || undefined,
      assignee: form.assigneeName || undefined,
      priority: form.priority,
      dueDate: form.dueDate || "TBD",
    });
    setModalOpen(false);
    setForm(defaultForm);
  };

  const handleDelete = useCallback(async (id: string) => {
    await deleteTask(id);
    if (selectedTask?.id === id) setSelectedTask(null);
  }, [deleteTask, selectedTask]);

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={11} style={{ color: "var(--text-muted)", opacity: 0.5 }} />;
    return sortDir === "asc" ? <ChevronUp size={11} style={{ color: "var(--accent)" }} /> : <ChevronDown size={11} style={{ color: "var(--accent)" }} />;
  }

  const VIEWS: { id: View; label: string; Icon: React.ElementType }[] = [
    { id: "my", label: "My Tasks", Icon: Target },
    { id: "kanban", label: "Kanban", Icon: LayoutGrid },
    { id: "table", label: "Table", Icon: List },
  ];

  const completedCount = tasks.filter(t => t.status === "done").length;

  return (
    <div style={{ paddingRight: liveSelected ? "min(92vw, 420px)" : 0, transition: "padding-right 0.3s ease" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
              <CheckSquare size={18} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {t("tasks.title")}
            </h1>
          </div>
          <div className="flex items-center gap-3 mt-3 ms-0">
            {[
              { label: "Total", value: tasks.length, color: "var(--text-secondary)", bg: "var(--surface-2)" },
              { label: "Open", value: openTaskCount, color: "#4f8ef7", bg: "rgba(79,142,247,0.10)" },
              { label: "Done", value: completedCount, color: "#34d399", bg: "rgba(52,211,153,0.10)" },
            ].map(chip => (
              <div key={chip.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: chip.bg, color: chip.color }}>
                <span className="font-bold">{chip.value}</span>
                <span className="opacity-70">{chip.label}</span>
              </div>
            ))}
          </div>
        </div>
        <Button icon={Plus} onClick={() => { setForm(defaultForm); setModalOpen(true); }}>
          {t("tasks.addTask")}
        </Button>
      </div>

      {/* View Toggle */}
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {VIEWS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all"
            style={{
              background: view === id ? "var(--accent)" : "transparent",
              color: view === id ? "white" : "var(--text-secondary)",
            }}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {tasks.length === 0 && (
        <EmptyState
          icon={CheckSquare}
          title={t("tasks.noTasksTitle")}
          description={t("tasks.noTasksDesc")}
          action={<Button icon={Plus} onClick={() => { setForm(defaultForm); setModalOpen(true); }}>{t("tasks.addTask")}</Button>}
        />
      )}

      {/* My Tasks View */}
      {view === "my" && tasks.length > 0 && (
        <div className="space-y-6">
          {(["high", "medium", "low"] as Priority[]).map(priority => {
            const group = tasksByPriority[priority];
            const PriorityIcon = PRIORITY_ICON[priority];
            const priorityLabels: Record<Priority, string> = { high: "🔴 High Priority", medium: "🟡 Medium Priority", low: "🔵 Low Priority" };
            return (
              <div key={priority}>
                <div className="flex items-center gap-2.5 mb-3">
                  <PriorityIcon size={14} style={{ color: PRIORITY_BORDER[priority] }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{priorityLabels[priority]}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: PRIORITY_BG[priority], color: PRIORITY_BORDER[priority] }}>
                    {group.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.length === 0 ? (
                    <p className="text-xs ps-4 py-2" style={{ color: "var(--text-muted)" }}>No {priority} priority tasks</p>
                  ) : (
                    <AnimatePresence>
                      {group.map(task => {
                        const client = clients.find(c => c.id === task.clientId);
                        const assigneeInitials = getAssigneeInitials(task, members);
                        const assigneeColor = getAssigneeColor(task, members);
                        const isDone = task.status === "done";
                        return (
                          <motion.div
                            key={task.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: isDone ? 0.55 : 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            onClick={() => setSelectedTask(task)}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer group transition-colors"
                            style={{
                              background: "var(--surface-1)",
                              border: "1px solid var(--border)",
                              borderLeft: `3px solid ${PRIORITY_BORDER[priority]}`,
                              boxShadow: "var(--shadow-sm)",
                            }}
                            whileHover={{ scale: 1.002, boxShadow: "var(--shadow-md)" }}
                          >
                            {/* Checkbox */}
                            <button
                              onClick={e => { e.stopPropagation(); toggleTaskDone(task.id); }}
                              className="flex-shrink-0 transition-transform hover:scale-110"
                            >
                              {isDone
                                ? <CheckCircle2 size={18} style={{ color: "#34d399" }} />
                                : <Circle size={18} style={{ color: "var(--text-muted)" }} />}
                            </button>

                            {/* Title */}
                            <span
                              className={`flex-1 text-sm font-medium truncate ${isDone ? "line-through" : ""}`}
                              style={{ color: "var(--text-primary)" }}
                            >
                              {task.title}
                            </span>

                            {/* Client chip */}
                            {client && (
                              <span
                                className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full flex-shrink-0"
                                style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                              >
                                {client.name}
                              </span>
                            )}

                            {/* Assignee */}
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
                              style={{ background: assigneeColor }}
                              title={getAssigneeName(task, members)}
                            >
                              {assigneeInitials}
                            </div>

                            {/* Due date */}
                            {task.dueDate && task.dueDate !== "TBD" && (
                              <span className="hidden md:flex items-center gap-1 text-[11px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                                <CalendarIcon size={10} />
                                {task.dueDate}
                              </span>
                            )}

                            {/* Priority badge */}
                            <Badge label={task.priority} color={PRIORITY_COLORS[priority]} />

                            {/* Arrow */}
                            <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban View */}
      {view === "kanban" && tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { status: "todo" as Status, label: "To Do", color: "#8888a0", accent: "rgba(136,136,160,0.12)" },
            { status: "in-progress" as Status, label: "In Progress", color: "#4f8ef7", accent: "rgba(79,142,247,0.10)" },
            { status: "done" as Status, label: "Done", color: "#34d399", accent: "rgba(52,211,153,0.10)" },
          ]).map(({ status, label, color, accent }) => {
            const col = tasksByStatus[status];
            return (
              <div
                key={status}
                className="rounded-2xl flex flex-col gap-3"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", minHeight: 240 }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2 px-4 py-3 rounded-t-2xl" style={{ background: accent, borderBottom: `2px solid ${color}33` }}>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-sm font-semibold flex-1" style={{ color: "var(--text-primary)" }}>{label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: color + "22", color }}>
                    {col.length}
                  </span>
                </div>

                <div className="px-3 pb-3 space-y-2 flex-1">
                  <AnimatePresence>
                    {col.map(task => {
                      const client = clients.find(c => c.id === task.clientId);
                      return (
                        <motion.div
                          key={task.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => setSelectedTask(task)}
                          className="rounded-xl p-3 cursor-pointer group"
                          style={{
                            background: "var(--surface-1)",
                            border: "1px solid var(--border)",
                            borderTop: `3px solid ${PRIORITY_BORDER[task.priority]}`,
                            boxShadow: "var(--shadow-sm)",
                          }}
                          whileHover={{ y: -1, boxShadow: "var(--shadow-md)" }}
                        >
                          <div className="flex items-start gap-2 mb-2">
                            <button onClick={e => { e.stopPropagation(); toggleTaskDone(task.id); }} className="mt-0.5 flex-shrink-0">
                              {task.status === "done"
                                ? <CheckCircle2 size={14} style={{ color: "#34d399" }} />
                                : <Circle size={14} style={{ color: "var(--text-muted)" }} />}
                            </button>
                            <p className={`text-sm flex-1 font-medium leading-snug ${task.status === "done" ? "line-through opacity-60" : ""}`} style={{ color: "var(--text-primary)" }}>
                              {task.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge label={task.priority} color={PRIORITY_COLORS[task.priority]} />
                            {client && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                                {client.name}
                              </span>
                            )}
                            {task.dueDate && task.dueDate !== "TBD" && (
                              <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                                <CalendarIcon size={9} />{task.dueDate}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: getAssigneeColor(task, members) }}>
                                {getAssigneeInitials(task, members)}
                              </div>
                              <span className="text-[11px] truncate max-w-[90px]" style={{ color: "var(--text-muted)" }}>
                                {getAssigneeName(task, members)}
                              </span>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded"
                              style={{ color: "var(--error)" }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {col.length === 0 && (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>No tasks</p>
                    </div>
                  )}
                  <button
                    onClick={() => { setForm({ ...defaultForm, status }); setModalOpen(true); }}
                    className="w-full py-2 text-xs rounded-xl transition-colors flex items-center justify-center gap-1 mt-1"
                    style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}
                    onMouseEnter={e => { (e.currentTarget).style.borderColor = color; (e.currentTarget).style.color = color; }}
                    onMouseLeave={e => { (e.currentTarget).style.borderColor = "var(--border)"; (e.currentTarget).style.color = "var(--text-muted)"; }}
                  >
                    <Plus size={11} /> Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && tasks.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                  {([
                    { f: "title" as SortField, l: "Title" },
                    { f: "priority" as SortField, l: "Priority" },
                    { f: "status" as SortField, l: "Status" },
                    { f: "assignee" as SortField, l: "Assignee" },
                    { f: "dueDate" as SortField, l: "Due Date" },
                  ] as { f: SortField; l: string }[]).map(col => (
                    <th key={col.f} onClick={() => handleSort(col.f)} className="text-left px-5 py-3.5 text-xs font-semibold cursor-pointer select-none uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      <span className="flex items-center gap-1.5">{col.l}<SortIcon field={col.f} /></span>
                    </th>
                  ))}
                  <th className="px-5 py-3.5 text-xs text-left font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Client</th>
                  <th className="px-5 py-3.5 text-xs text-right font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {sortedTable.map((task, i) => {
                    const client = clients.find(c => c.id === task.clientId);
                    const isDone = task.status === "done";
                    return (
                      <motion.tr
                        key={task.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedTask(task)}
                        className="cursor-pointer group"
                        style={{ borderBottom: i < sortedTable.length - 1 ? "1px solid var(--border)" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => { e.stopPropagation(); toggleTaskDone(task.id); }}
                              className="flex-shrink-0"
                            >
                              {isDone
                                ? <CheckCircle2 size={15} style={{ color: "#34d399" }} />
                                : <Circle size={15} style={{ color: "var(--text-muted)" }} />}
                            </button>
                            <span className={`text-sm font-medium ${isDone ? "line-through opacity-50" : ""}`} style={{ color: "var(--text-primary)" }}>
                              {task.title}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge label={task.priority} color={PRIORITY_COLORS[task.priority]} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="flex items-center gap-1.5 text-xs font-medium w-fit px-2.5 py-1 rounded-full"
                            style={{ color: STATUS_COLORS[task.status], background: STATUS_COLORS[task.status] + "18" }}
                          >
                            {task.status === "done" ? <CheckCircle2 size={11} /> : task.status === "in-progress" ? <Clock size={11} /> : <Circle size={11} />}
                            {STATUS_LABELS[task.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: getAssigneeColor(task, members) }}>
                              {getAssigneeInitials(task, members)}
                            </div>
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                              {getAssigneeName(task, members)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                            <CalendarIcon size={11} />
                            {task.dueDate || "—"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>
                          {client ? (
                            <span className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: client.color }}>
                                {client.initials}
                              </div>
                              {client.name}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); setSelectedTask(task); }}
                              className="text-xs px-2.5 py-1 rounded-lg"
                              style={{ color: "var(--text-secondary)", background: "var(--surface-3)" }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDelete(task.id); }}
                              className="text-xs px-2.5 py-1 rounded-lg"
                              style={{ color: "var(--error)", background: "rgba(248,113,113,0.10)" }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Side Panel */}
      <AnimatePresence>
        {liveSelected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.20)" }}
              onClick={() => setSelectedTask(null)}
            />
            <DetailPanel
              task={liveSelected}
              members={members}
              clients={clients}
              onClose={() => setSelectedTask(null)}
              onUpdate={updateTask}
              onDelete={handleDelete}
              onToggleDone={toggleTaskDone}
              membersLoading={membersLoading}
            />
          </>
        )}
      </AnimatePresence>

      {/* Add Task Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setForm(defaultForm); }} title={t("tasks.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("tasks.titleLabel")}
            placeholder={t("tasks.titlePlaceholder")}
            value={form.title}
            onChange={v => setForm(p => ({ ...p, title: v }))}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Client</label>
            <select
              value={form.clientId}
              onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
              className="glass-input rounded-xl px-3.5 py-2.5 text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
            >
              <option value="">No client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <AssigneeSelect
            members={members}
            loading={membersLoading}
            value={form.assigneeId}
            onChange={(id, name) => setForm(p => ({ ...p, assigneeId: id, assigneeName: name }))}
            label={t("tasks.assigneeLabel")}
          />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("tasks.priorityLabel")}</label>
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as Priority[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                    className="flex-1 py-2 text-xs font-medium rounded-xl transition-all capitalize"
                    style={{
                      background: form.priority === p ? PRIORITY_BG[p] : "var(--surface-2)",
                      color: form.priority === p ? PRIORITY_BORDER[p] : "var(--text-muted)",
                      border: `1px solid ${form.priority === p ? PRIORITY_BORDER[p] + "66" : "var(--border)"}`,
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("tasks.dueDateLabel")}</label>
              <div className="relative">
                <CalendarIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="glass-input w-full rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
                  style={{ color: "var(--text-primary)" }}
                />
              </div>
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <Button variant="ghost" onClick={() => { setModalOpen(false); setForm(defaultForm); }}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!form.title.trim()} icon={Plus}>{t("tasks.createButton")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
