"use client";
import { useState } from "react";
import { CheckSquare, Plus, Search, Circle, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

type Priority = "high" | "medium" | "low";
type Status = "todo" | "in-progress" | "done";

interface Task {
  id: number;
  title: string;
  project: string;
  assignee: string;
  priority: Priority;
  status: Status;
  dueDate: string;
}

const priorityColors: Record<Priority, "red" | "yellow" | "blue"> = {
  high: "red", medium: "yellow", low: "blue",
};

const statusGroups: { key: Status; label: string; icon: typeof Circle }[] = [
  { key: "todo", label: "To Do", icon: Circle },
  { key: "in-progress", label: "In Progress", icon: AlertCircle },
  { key: "done", label: "Done", icon: CheckCircle2 },
];

const initialTasks: Task[] = [
  { id: 1, title: "Review API documentation", project: "Atlas Platform v2", assignee: "Alex Chen", priority: "high", status: "todo", dueDate: "Mar 28" },
  { id: 2, title: "Design onboarding flow", project: "Nexus Dashboard", assignee: "Sarah Kim", priority: "medium", status: "in-progress", dueDate: "Mar 30" },
  { id: 3, title: "Fix auth token refresh bug", project: "Atlas Platform v2", assignee: "Marcus Lee", priority: "high", status: "in-progress", dueDate: "Mar 27" },
  { id: 4, title: "Update client contracts", project: "Titan Labs", assignee: "Priya Nair", priority: "medium", status: "todo", dueDate: "Apr 2" },
  { id: 5, title: "Database schema migration", project: "Prism CMS", assignee: "James Wright", priority: "high", status: "done", dueDate: "Mar 25" },
  { id: 6, title: "Implement dark mode", project: "Nexus Dashboard", assignee: "Sarah Kim", priority: "low", status: "done", dueDate: "Mar 24" },
  { id: 7, title: "Performance audit", project: "Atlas Platform v2", assignee: "Marcus Lee", priority: "medium", status: "todo", dueDate: "Apr 5" },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", project: "", assignee: "", priority: "medium" as Priority, dueDate: "" });

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.project.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.title) return;
    setTasks(prev => [...prev, {
      id: Date.now(),
      title: form.title,
      project: form.project || "—",
      assignee: form.assignee || "Unassigned",
      priority: form.priority,
      status: "todo",
      dueDate: form.dueDate || "TBD",
    }]);
    setForm({ title: "", project: "", assignee: "", priority: "medium", dueDate: "" });
    setModalOpen(false);
  };

  const toggleDone = (id: number) => {
    setTasks(prev => prev.map(t =>
      t.id === id ? { ...t, status: t.status === "done" ? "todo" : "done" } : t
    ));
  };

  return (
    <div>
      <SectionHeader
        title="Tasks"
        subtitle={`${tasks.filter(t => t.status !== "done").length} open · ${tasks.filter(t => t.status === "done").length} completed`}
        icon={CheckSquare}
        action={<Button icon={Plus} onClick={() => setModalOpen(true)}>New Task</Button>}
      />

      <div className="mb-5">
        <Input placeholder="Search tasks..." value={search} onChange={setSearch} icon={Search} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks found"
          description="Create tasks to track your work."
          action={<Button icon={Plus} onClick={() => setModalOpen(true)}>New Task</Button>}
        />
      ) : (
        <div className="space-y-6">
          {statusGroups.map(({ key, label, icon: Icon }) => {
            const groupTasks = filtered.filter(t => t.status === key);
            if (groupTasks.length === 0) return null;
            return (
              <div key={key}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon size={14} style={{ color: key === "done" ? 'var(--success)' : key === "in-progress" ? 'var(--accent)' : 'var(--text-muted)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span
                    className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                  >
                    {groupTasks.length}
                  </span>
                </div>
                <Card padding="sm">
                  <div>
                    {groupTasks.map((task, i) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 py-3"
                        style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}
                      >
                        <button
                          onClick={() => toggleDone(task.id)}
                          className="mt-0.5 flex-shrink-0 transition-all"
                          style={{ color: task.status === "done" ? 'var(--success)' : 'var(--text-muted)' }}
                        >
                          {task.status === "done" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: task.status === "done" ? 'var(--text-muted)' : 'var(--text-primary)',
                              textDecoration: task.status === "done" ? 'line-through' : 'none',
                            }}
                          >
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{task.project}</span>
                            <span style={{ color: 'var(--border-strong)' }}>·</span>
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{task.assignee}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge label={task.priority} color={priorityColors[task.priority]} />
                          <div className="flex items-center gap-1">
                            <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{task.dueDate}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create New Task">
        <div className="space-y-4">
          <Input
            label="Task Title"
            placeholder="Describe the task..."
            value={form.title}
            onChange={v => setForm(p => ({ ...p, title: v }))}
            required
          />
          <Input label="Project" placeholder="Which project?" value={form.project} onChange={v => setForm(p => ({ ...p, project: v }))} />
          <Input label="Assignee" placeholder="Who handles this?" value={form.assignee} onChange={v => setForm(p => ({ ...p, assignee: v }))} />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Priority</label>
            <div className="flex gap-2">
              {(["high", "medium", "low"] as Priority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                  className="flex-1 py-2 rounded-xl text-xs font-medium capitalize transition-all"
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
                  {p}
                </button>
              ))}
            </div>
          </div>
          <Input label="Due Date" placeholder="e.g. Apr 15" value={form.dueDate} onChange={v => setForm(p => ({ ...p, dueDate: v }))} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.title}>Create Task</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
