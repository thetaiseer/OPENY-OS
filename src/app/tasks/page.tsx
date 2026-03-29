"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Plus, Search, Circle, CheckCircle2, AlertCircle, Clock, Trash2, ChevronDown, Loader2, Users } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTasks, useTeam, useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { Task, TeamMember } from "@/lib/types";

type Priority = Task["priority"];
type Status = Task["status"];

const priorityColors: Record<Priority, "red" | "yellow" | "blue"> = {
  high: "red", medium: "yellow", low: "blue",
};

// ── Assignee Dropdown ─────────────────────────────────────────

interface AssigneeSelectProps {
  members: TeamMember[];
  loading: boolean;
  value: string; // assigneeId
  onChange: (id: string, name: string) => void;
  label: string;
  required?: boolean;
  t: (k: string) => string;
}

function AssigneeSelect({ members, loading, value, onChange, label, required, t }: AssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const activeMembers = members.filter((m) => m.status === "active");
  const filtered = activeMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = members.find((m) => m.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </label>

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !loading && setOpen((v) => !v)}
        className="glass-input w-full rounded-xl px-3.5 py-2.5 text-sm text-start flex items-center justify-between gap-2 transition-all"
        style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}
      >
        {loading ? (
          <span className="flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <Loader2 size={13} className="animate-spin" />
            {t("tasks.assigneeLoading")}
          </span>
        ) : selected ? (
          <span className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
              style={{ background: selected.color }}
            >
              {selected.initials}
            </span>
            <span>{selected.name}</span>
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>· {selected.role}</span>
          </span>
        ) : (
          <span>{t("tasks.assigneePlaceholder")}</span>
        )}
        <ChevronDown size={14} style={{ color: "var(--text-muted)", flexShrink: 0, transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute z-50 rounded-2xl shadow-xl overflow-hidden"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            width: "100%",
            maxWidth: 320,
            marginTop: 2,
          }}
        >
          {activeMembers.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center gap-3 p-5">
              <Users size={28} style={{ color: "var(--text-muted)" }} />
              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                {t("tasks.assigneeNoMembers")}
              </p>
              <button
                type="button"
                className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all"
                style={{ background: "var(--accent)", color: "#fff" }}
                onClick={() => { setOpen(false); router.push("/team"); }}
              >
                {t("tasks.assigneeGoToTeam")}
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              {activeMembers.length > 5 && (
                <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <input
                    className="glass-input w-full rounded-lg px-3 py-1.5 text-xs outline-none"
                    placeholder={t("tasks.assigneeSearchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
              )}

              {/* Unassigned option */}
              <button
                type="button"
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all hover:opacity-80"
                style={{
                  background: !value ? "rgba(79,142,247,0.1)" : "transparent",
                  color: "var(--text-muted)",
                }}
                onClick={() => { onChange("", ""); setOpen(false); setSearch(""); }}
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--surface-3)" }}
                >
                  <Users size={11} style={{ color: "var(--text-muted)" }} />
                </span>
                <span>{t("tasks.assigneeUnassigned")}</span>
              </button>

              {/* Member list */}
              <div className="max-h-52 overflow-y-auto">
                {filtered.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-all hover:opacity-80"
                    style={{
                      background: value === m.id ? "rgba(79,142,247,0.1)" : "transparent",
                      color: "var(--text-primary)",
                    }}
                    onClick={() => { onChange(m.id, m.name); setOpen(false); setSearch(""); }}
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ background: m.color }}
                    >
                      {m.initials}
                    </span>
                    <span className="flex-1 text-start">{m.name}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{m.role}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-3 text-xs text-center" style={{ color: "var(--text-muted)" }}>
                    {t("tasks.assigneeNoResults")}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function TasksPage() {
  const { tasks, addTask, toggleTaskDone, deleteTask } = useTasks();
  const { members } = useTeam();
  const { loading } = useAppStore();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assigneeId: "",
    assigneeName: "",
    priority: "medium" as Priority,
    dueDate: "",
  });

  // Wrapper ref for positioning dropdown relative to the modal form
  const assigneeWrapRef = useRef<HTMLDivElement>(null);

  const statusGroups: { key: Status; label: string; icon: typeof Circle }[] = [
    { key: "todo",        label: t("tasks.statusTodo"),       icon: Circle },
    { key: "in-progress", label: t("tasks.statusInProgress"), icon: AlertCircle },
    { key: "done",        label: t("tasks.statusDone"),       icon: CheckCircle2 },
  ];

  const priorityLabels: Record<Priority, string> = {
    high: t("tasks.priorityHigh"),
    medium: t("tasks.priorityMedium"),
    low: t("tasks.priorityLow"),
  };

  const filtered = tasks.filter((t) =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.assigneeName ?? t.assignee ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.title) return;
    addTask({
      title: form.title,
      assigneeId: form.assigneeId,
      assigneeName: form.assigneeName,
      priority: form.priority,
      dueDate: form.dueDate,
    });
    setForm({ title: "", assigneeId: "", assigneeName: "", priority: "medium", dueDate: "" });
    setModalOpen(false);
  };

  const openCount = tasks.filter((t) => t.status !== "done").length;
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const subtitle = `${openCount} ${t("tasks.open")} · ${doneCount} ${t("tasks.completed")}`;

  /** Resolve display name for a task — handles both old (text) and new (id-based) formats */
  function getTaskAssigneeName(task: Task): string {
    if (task.assigneeName) return task.assigneeName;
    if (task.assignee && task.assignee !== "Unassigned") return task.assignee;
    if (task.assigneeId) {
      const member = members.find((m) => m.id === task.assigneeId);
      if (member) return member.name;
      return t("tasks.assigneeDeletedMember");
    }
    return "";
  }

  return (
    <div>
      <SectionHeader
        title={t("tasks.title")}
        subtitle={subtitle}
        icon={CheckSquare}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("tasks.addTask")}</Button>}
      />

      <div className="mb-5">
        <Input placeholder={t("tasks.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={t("tasks.noTasksTitle")}
          description={t("tasks.noTasksDesc")}
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("tasks.addTask")}</Button>}
        />
      ) : (
        <div className="space-y-6">
          {statusGroups.map(({ key, label, icon: Icon }) => {
            const groupTasks = filtered.filter((t) => t.status === key);
            if (groupTasks.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} style={{ color: key === "done" ? "var(--success)" : key === "in-progress" ? "var(--accent)" : "var(--text-muted)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span
                    className="ms-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
                  >
                    {groupTasks.length}
                  </span>
                </div>
                <Card padding="sm">
                  <div>
                    {groupTasks.map((task, i) => {
                      const assigneeName = getTaskAssigneeName(task);
                      const assigneeMember = task.assigneeId ? members.find((m) => m.id === task.assigneeId) : undefined;
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 py-3"
                          style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
                        >
                          <button
                            onClick={() => toggleTaskDone(task.id)}
                            className="mt-0.5 flex-shrink-0 transition-all"
                            style={{ color: task.status === "done" ? "var(--success)" : "var(--text-muted)" }}
                          >
                            {task.status === "done" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-sm font-medium"
                              style={{
                                color: task.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                                textDecoration: task.status === "done" ? "line-through" : "none",
                              }}
                            >
                              {task.title}
                            </p>
                            {assigneeName && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {assigneeMember ? (
                                  <span
                                    className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
                                    style={{ background: assigneeMember.color }}
                                  >
                                    {assigneeMember.initials}
                                  </span>
                                ) : null}
                                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{assigneeName}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge label={priorityLabels[task.priority]} color={priorityColors[task.priority]} />
                            <div className="flex items-center gap-1">
                              <Clock size={11} style={{ color: "var(--text-muted)" }} />
                              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{task.dueDate}</span>
                            </div>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="transition-all p-0.5 rounded"
                              style={{ color: "var(--text-muted)" }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("tasks.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("tasks.titleLabel")}
            placeholder={t("tasks.titlePlaceholder")}
            value={form.title}
            onChange={(v) => setForm((p) => ({ ...p, title: v }))}
            required
          />

          {/* Assignee dropdown — positioned relatively so dropdown overlay works */}
          <div ref={assigneeWrapRef} className="relative">
            <AssigneeSelect
              members={members}
              loading={loading}
              value={form.assigneeId}
              onChange={(id, name) => setForm((p) => ({ ...p, assigneeId: id, assigneeName: name }))}
              label={t("tasks.assigneeLabel")}
              t={t}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{t("tasks.priorityLabel")}</label>
            <div className="flex gap-2">
              {(["high", "medium", "low"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                  className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: form.priority === p
                      ? (p === "high" ? "rgba(248,113,113,0.2)" : p === "medium" ? "rgba(251,191,36,0.2)" : "rgba(79,142,247,0.2)")
                      : "var(--surface-3)",
                    color: form.priority === p
                      ? (p === "high" ? "#f87171" : p === "medium" ? "#fbbf24" : "#4f8ef7")
                      : "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {priorityLabels[p]}
                </button>
              ))}
            </div>
          </div>
          <Input label={t("tasks.dueDateLabel")} placeholder={t("tasks.dueDatePlaceholder")} value={form.dueDate} onChange={(v) => setForm((p) => ({ ...p, dueDate: v }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.title}>{t("tasks.createButton")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

