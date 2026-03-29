"use client";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  CheckSquare, Plus, Search, Circle, CheckCircle2, Clock, Trash2,
  ChevronDown, Loader2, LayoutGrid, List, User, ArrowUpDown,
  ChevronUp, Calendar as CalendarIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTasks, useTeam, useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Task, TeamMember, Client } from "@/lib/types";

type View = "board" | "table" | "my" | "calendar";
type Priority = Task["priority"];
type Status = Task["status"];
type SortField = "title" | "status" | "priority" | "dueDate" | "assignee";
type SortDir = "asc" | "desc";

const PRIORITY_COLORS: Record<Priority, "red" | "yellow" | "blue"> = {
  high: "red", medium: "yellow", low: "blue",
};
const PRIORITY_WEIGHT: Record<Priority, number> = { high: 3, medium: 2, low: 1 };
const CURRENT_USER = "Alex Chen";

// ── Assignee Dropdown ─────────────────────────────────────────
interface AssigneeSelectProps {
  members: TeamMember[];
  loading: boolean;
  value: string;
  onChange: (id: string, name: string) => void;
  label: string;
  t: (k: string) => string;
}

function AssigneeSelect({ members, loading, value, onChange, label, t }: AssigneeSelectProps) {
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
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <button
        type="button"
        onClick={() => !loading && setOpen(v => !v)}
        className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-start flex items-center justify-between gap-2"
        style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {loading ? (
          <span className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={13} className="animate-spin" />{t("tasks.assigneeLoading")}
          </span>
        ) : selected ? (
          <span className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: selected.color }}>{selected.initials}</span>
            <span>{selected.name}</span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {selected.role}</span>
          </span>
        ) : <span>{t("tasks.assigneePlaceholder")}</span>}
        <ChevronDown size={14} style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>
      {open && (
        <div className="absolute z-50 rounded-2xl shadow-xl overflow-hidden top-full mt-1 w-full" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <input autoFocus placeholder={t("tasks.assigneeSearchPlaceholder")} value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent text-sm px-2 py-1 outline-none" style={{ color: "var(--text-primary)" }} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 220 }}>
            <button type="button" onClick={() => { onChange("", t("tasks.assigneeUnassigned")); setOpen(false); setSearch(""); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-start transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-3)")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-3)", border: "1px dashed var(--border)" }}>
                <User size={12} style={{ color: "var(--text-muted)" }} />
              </div>
              {t("tasks.assigneeUnassigned")}
            </button>
            {filtered.length === 0
              ? <p className="text-xs text-center py-3" style={{ color: "var(--text-muted)" }}>{t("tasks.assigneeNoResults")}</p>
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

// ── Calendar View ─────────────────────────────────────────────
interface CalendarViewProps {
  tasks: Task[];
  clients: Client[];
  members: TeamMember[];
  onEdit: (t: Task) => void;
}

function CalendarView({ tasks, clients, onEdit }: CalendarViewProps) {
  const [current, setCurrent] = useState(() => new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = current.toLocaleString("default", { month: "long", year: "numeric" });

  function taskDate(dueDate: string): number | null {
    if (!dueDate || dueDate === "TBD") return null;
    const d = new Date(dueDate);
    if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) return d.getDate();
    return null;
  }

  const tasksByDay = useMemo(() => {
    const map: Record<number, Task[]> = {};
    tasks.forEach(t => {
      const day = taskDate(t.dueDate);
      if (day !== null) { if (!map[day]) map[day] = []; map[day].push(t); }
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, year, month]);

  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1,
  );
  const today = new Date();

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--glass-card)" }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => setCurrent(new Date(year, month - 1))} className="p-1.5 rounded-xl transition-colors hover:opacity-70" style={{ color: "var(--text-secondary)", background: "var(--surface-3)" }}>
          <ChevronUp size={14} />
        </button>
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{monthName}</span>
        <button onClick={() => setCurrent(new Date(year, month + 1))} className="p-1.5 rounded-xl transition-colors hover:opacity-70" style={{ color: "var(--text-secondary)", background: "var(--surface-3)" }}>
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center" style={{ borderBottom: "1px solid var(--border)" }}>
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="py-2 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          const isToday = day && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
          const dayTasks = day ? (tasksByDay[day] ?? []) : [];
          return (
            <div key={idx} className="min-h-[80px] p-1.5 transition-colors"
              style={{ borderRight: idx % 7 !== 6 ? "1px solid var(--border)" : "none", borderBottom: "1px solid var(--border)" }}>
              {day && (
                <>
                  <div className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 ${isToday ? "text-white" : ""}`}
                    style={{ background: isToday ? "var(--accent)" : "transparent", color: isToday ? "white" : "var(--text-muted)" }}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 2).map(task => (
                      <div key={task.id} onClick={() => onEdit(task)}
                        className="text-[10px] px-1.5 py-0.5 rounded-md truncate cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        {task.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{dayTasks.length - 2} more</div>}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
type FormData = {
  title: string; clientId: string; assigneeId: string;
  assigneeName: string; priority: Priority; dueDate: string; status: Status;
};
const defaultForm: FormData = { title: "", clientId: "", assigneeId: "", assigneeName: "", priority: "medium", dueDate: "", status: "todo" };

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, toggleTaskDone } = useTasks();
  const { members } = useTeam();
  const { clients, loading } = useAppStore();
  const { t } = useLanguage();

  const [view, setView] = useState<View>("board");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const getAssigneeName = useCallback((task: Task) => {
    if (task.assigneeName) return task.assigneeName;
    if (task.assigneeId) { const m = members.find(m => m.id === task.assigneeId); if (m) return m.name; }
    return task.assignee || task.assignedTo || t("tasks.assigneeUnassigned");
  }, [members, t]);

  const getAssigneeColor = useCallback((task: Task) => {
    if (task.assigneeId) { const m = members.find(m => m.id === task.assigneeId); if (m) return m.color; }
    return "#8888a0";
  }, [members]);

  const getAssigneeInitials = useCallback((task: Task) => {
    return getAssigneeName(task).split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  }, [getAssigneeName]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = tasks.filter(task =>
      task.title.toLowerCase().includes(q) || getAssigneeName(task).toLowerCase().includes(q),
    );
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (priorityFilter !== "all") list = list.filter(t => t.priority === priorityFilter);
    return list;
  }, [tasks, search, statusFilter, priorityFilter, getAssigneeName]);

  const myTasks = useMemo(() => filtered.filter(t => getAssigneeName(t) === CURRENT_USER), [filtered, getAssigneeName]);
  const tasksByStatus = useMemo(() => ({
    todo: filtered.filter(t => t.status === "todo"),
    "in-progress": filtered.filter(t => t.status === "in-progress"),
    done: filtered.filter(t => t.status === "done"),
  }), [filtered]);

  const sortedTable = useMemo(() => [...filtered].sort((a, b) => {
    let av: string | number = "", bv: string | number = "";
    if (sortField === "title") { av = a.title; bv = b.title; }
    else if (sortField === "status") { av = a.status; bv = b.status; }
    else if (sortField === "priority") { av = PRIORITY_WEIGHT[a.priority]; bv = PRIORITY_WEIGHT[b.priority]; }
    else if (sortField === "dueDate") { av = a.dueDate; bv = b.dueDate; }
    else if (sortField === "assignee") { av = getAssigneeName(a); bv = getAssigneeName(b); }
    if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [filtered, sortField, sortDir, getAssigneeName]);

  const handleSort = (f: SortField) => { if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortField(f); setSortDir("asc"); } };
  const openAdd = (preStatus?: Status) => { setEditTask(null); setForm({ ...defaultForm, status: preStatus ?? "todo" }); setModalOpen(true); };
  const openEdit = (task: Task) => { setEditTask(task); setForm({ title: task.title, clientId: task.clientId ?? "", assigneeId: task.assigneeId ?? "", assigneeName: task.assigneeName ?? task.assignee ?? "", priority: task.priority, dueDate: task.dueDate, status: task.status }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditTask(null); setForm(defaultForm); };

  const handleSubmit = async () => {
    if (!form.title) return;
    if (editTask) {
      await updateTask(editTask.id, { title: form.title, clientId: form.clientId, assigneeId: form.assigneeId, assigneeName: form.assigneeName, assignee: form.assigneeName, priority: form.priority, dueDate: form.dueDate, status: form.status });
    } else {
      await addTask({ title: form.title, clientId: form.clientId || undefined, assigneeId: form.assigneeId || undefined, assigneeName: form.assigneeName || undefined, priority: form.priority, dueDate: form.dueDate });
    }
    closeModal();
  };

  const STATUS_CONFIG = {
    todo: { label: t("tasks.statusTodo"), color: "#8888a0", Icon: Circle },
    "in-progress": { label: t("tasks.statusInProgress"), color: "#4f8ef7", Icon: Clock },
    done: { label: t("tasks.statusDone"), color: "#34d399", Icon: CheckCircle2 },
  } as const;

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown size={11} style={{ color: "var(--text-muted)", opacity: 0.5 }} />;
    return sortDir === "asc" ? <ChevronUp size={11} style={{ color: "var(--accent)" }} /> : <ChevronDown size={11} style={{ color: "var(--accent)" }} />;
  }

  function TaskCard({ task }: { task: Task }) {
    const client = clients.find(c => c.id === task.clientId);
    const conf = STATUS_CONFIG[task.status];
    return (
      <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
        className="rounded-xl p-3 cursor-pointer group" onClick={() => openEdit(task)} whileHover={{ y: -1 }}
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-start gap-2 mb-2">
          <button onClick={e => { e.stopPropagation(); toggleTaskDone(task.id); }} className="mt-0.5 flex-shrink-0">
            <conf.Icon size={15} style={{ color: conf.color }} />
          </button>
          <p className={`text-sm flex-1 font-medium leading-snug ${task.status === "done" ? "line-through opacity-60" : ""}`} style={{ color: "var(--text-primary)" }}>{task.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge label={task.priority} color={PRIORITY_COLORS[task.priority]} />
          {client && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{client.name}</span>}
          {task.dueDate && task.dueDate !== "TBD" && (
            <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-muted)" }}><Clock size={9} />{task.dueDate}</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: getAssigneeColor(task) }}>{getAssigneeInitials(task)}</div>
            <span className="text-[11px] truncate max-w-[100px]" style={{ color: "var(--text-muted)" }}>{getAssigneeName(task)}</span>
          </div>
          <button onClick={e => { e.stopPropagation(); deleteTask(task.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded" style={{ color: "var(--error)" }}>
            <Trash2 size={11} />
          </button>
        </div>
      </motion.div>
    );
  }

  const VIEWS: { id: View; label: string; Icon: React.ElementType }[] = [
    { id: "board", label: "Board", Icon: LayoutGrid },
    { id: "table", label: "Table", Icon: List },
    { id: "my", label: "My Tasks", Icon: User },
    { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  ];

  const tableRows = view === "my" ? myTasks : sortedTable;

  return (
    <div>
      <SectionHeader
        title={t("tasks.title")}
        subtitle="Track, assign, and complete your work"
        icon={CheckSquare}
        action={<Button icon={Plus} onClick={() => openAdd()}>{t("tasks.addTask")}</Button>}
      />

      {/* View Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit flex-wrap" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {VIEWS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all"
            style={{ background: view === id ? "var(--accent)" : "transparent", color: view === id ? "white" : "var(--text-secondary)" }}>
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex-1">
          <Input placeholder={t("tasks.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as Status | "all")}
          className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
          style={{ color: "var(--text-primary)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <option value="all">All Status</option>
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as Priority | "all")}
          className="glass-input rounded-xl px-3 py-2 text-sm outline-none"
          style={{ color: "var(--text-primary)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <option value="all">All Priority</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Board View */}
      {view === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["todo", "in-progress", "done"] as Status[]).map(status => {
            const conf = STATUS_CONFIG[status];
            const statusTasks = tasksByStatus[status];
            return (
              <div key={status} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", minHeight: 200 }}>
                <div className="flex items-center gap-2 mb-1">
                  <conf.Icon size={15} style={{ color: conf.color }} />
                  <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{conf.label}</span>
                  <span className="ms-auto text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>{statusTasks.length}</span>
                </div>
                <AnimatePresence>
                  {statusTasks.map(task => <TaskCard key={task.id} task={task} />)}
                </AnimatePresence>
                {statusTasks.length === 0 && (
                  <div className="flex-1 flex items-center justify-center py-6">
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No tasks</p>
                  </div>
                )}
                <button onClick={() => openAdd(status)}
                  className="w-full py-2 text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
                  style={{ color: "var(--text-muted)", border: "1px dashed var(--border)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
                  <Plus size={11} /> Add Task
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Table / My Tasks View */}
      {(view === "table" || view === "my") && (
        tableRows.length === 0 ? (
          <EmptyState icon={CheckSquare} title={t("tasks.noTasksTitle")} description={t("tasks.noTasksDesc")} action={<Button icon={Plus} onClick={() => openAdd()}>{t("tasks.addTask")}</Button>} />
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--glass-card)" }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                    {([
                      { f: "title" as SortField, l: "Title" },
                      { f: "status" as SortField, l: "Status" },
                      { f: "priority" as SortField, l: "Priority" },
                      { f: "assignee" as SortField, l: "Assignee" },
                      { f: "dueDate" as SortField, l: "Due Date" },
                    ]).map(col => (
                      <th key={col.f} onClick={() => handleSort(col.f)} className="text-left px-5 py-3 text-xs font-medium cursor-pointer select-none" style={{ color: "var(--text-secondary)" }}>
                        <span className="flex items-center gap-1.5">{col.l}<SortIcon field={col.f} /></span>
                      </th>
                    ))}
                    <th className="px-5 py-3 text-xs text-right font-medium" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((task, i) => {
                    const client = clients.find(c => c.id === task.clientId);
                    const conf = STATUS_CONFIG[task.status];
                    return (
                      <tr key={task.id}
                        style={{ borderBottom: i < tableRows.length - 1 ? "1px solid var(--border)" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <button onClick={() => toggleTaskDone(task.id)}><conf.Icon size={14} style={{ color: conf.color }} /></button>
                            <span className={`text-sm font-medium ${task.status === "done" ? "line-through opacity-60" : ""}`} style={{ color: "var(--text-primary)" }}>{task.title}</span>
                            {client && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{client.name}</span>}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: conf.color }}><conf.Icon size={12} />{conf.label}</span>
                        </td>
                        <td className="px-5 py-3.5"><Badge label={task.priority} color={PRIORITY_COLORS[task.priority]} /></td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white" style={{ background: getAssigneeColor(task) }}>{getAssigneeInitials(task)}</div>
                            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{getAssigneeName(task)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs" style={{ color: "var(--text-muted)" }}>{task.dueDate}</td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(task)} className="text-xs px-2.5 py-1 rounded-lg" style={{ color: "var(--text-secondary)", background: "var(--surface-3)" }}>Edit</button>
                            <button onClick={() => deleteTask(task.id)} className="text-xs px-2.5 py-1 rounded-lg" style={{ color: "var(--error)", background: "rgba(248,113,113,0.10)" }}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Calendar View */}
      {view === "calendar" && (
        <CalendarView tasks={filtered} clients={clients} members={members} onEdit={openEdit} />
      )}

      {/* Task Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editTask ? "Edit Task" : t("tasks.modalTitle")}>
        <div className="space-y-4">
          <Input label={t("tasks.titleLabel")} placeholder={t("tasks.titlePlaceholder")} value={form.title} onChange={v => setForm(p => ({ ...p, title: v }))} required />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Client</label>
            <select value={form.clientId} onChange={e => setForm(p => ({ ...p, clientId: e.target.value }))}
              className="glass-input rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ color: "var(--text-primary)" }}>
              <option value="">No client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <AssigneeSelect members={members} loading={loading} value={form.assigneeId}
            onChange={(id, name) => setForm(p => ({ ...p, assigneeId: id, assigneeName: name }))}
            label={t("tasks.assigneeLabel")} t={t} />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("tasks.priorityLabel")}</label>
              <div className="flex gap-1.5">
                {(["low", "medium", "high"] as Priority[]).map(p => (
                  <button key={p} type="button" onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                    className="flex-1 py-2 text-xs font-medium rounded-xl transition-all capitalize"
                    style={{
                      background: form.priority === p ? (p === "high" ? "rgba(248,113,113,0.18)" : p === "medium" ? "rgba(251,191,36,0.18)" : "rgba(79,142,247,0.15)") : "var(--surface-2)",
                      color: form.priority === p ? (p === "high" ? "var(--error)" : p === "medium" ? "var(--warning)" : "var(--accent)") : "var(--text-muted)",
                      border: `1px solid ${form.priority === p ? (p === "high" ? "rgba(248,113,113,0.35)" : p === "medium" ? "rgba(251,191,36,0.35)" : "rgba(79,142,247,0.25)") : "var(--border)"}`,
                    }}>{p}</button>
                ))}
              </div>
            </div>
            <Input label={t("tasks.dueDateLabel")} placeholder={t("tasks.dueDatePlaceholder")} value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} />
          </div>
          {editTask && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Status</label>
              <div className="flex gap-2">
                {(["todo", "in-progress", "done"] as Status[]).map(s => (
                  <button key={s} type="button" onClick={() => setForm(p => ({ ...p, status: s }))}
                    className="flex-1 py-2 text-xs font-medium rounded-xl transition-all"
                    style={{ background: form.status === s ? "var(--accent-dim)" : "var(--surface-2)", color: form.status === s ? "var(--accent)" : "var(--text-muted)", border: `1px solid ${form.status === s ? "var(--accent)" : "var(--border)"}` }}>
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)" }}>
            <Button variant="ghost" onClick={closeModal}>{t("common.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={!form.title}>{editTask ? t("common.save") : t("tasks.createButton")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
