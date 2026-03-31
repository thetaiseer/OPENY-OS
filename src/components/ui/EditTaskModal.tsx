"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Modal } from "./Modal";
import { useTasks, useTeam, useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { useToast } from "@/lib/ToastContext";
import type { Task } from "@/lib/types";

interface EditTaskModalProps {
  task: Task | null;
  onClose: () => void;
}

export function EditTaskModal({ task, onClose }: EditTaskModalProps) {
  const { updateTask } = useTasks();
  const { members } = useTeam();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { showToast } = useToast();

  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [dueDate, setDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Populate fields when the target task changes
  useEffect(() => {
    if (task) {
      setTitle(task.title ?? "");
      setAssigneeId(task.assigneeId ?? "");
      setClientId(task.clientId ?? "");
      setPriority(task.priority ?? "medium");
      setStatus(task.status ?? "todo");
      // Normalize "TBD" back to empty so the date picker works
      setDueDate(task.dueDate === "TBD" ? "" : (task.dueDate ?? ""));
      setError("");
    }
  }, [task]);

  const handleClose = () => {
    setError("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!title.trim()) {
      setError(isAr ? "عنوان المهمة مطلوب" : "Task title is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const assignee = members.find((m) => m.id === assigneeId);
      await updateTask(task.id, {
        title: title.trim(),
        clientId: clientId || "",
        assigneeId: assigneeId || "",
        assignedTo: assigneeId || "",
        assignee: assignee?.name ?? "Unassigned",
        assigneeName: assignee?.name ?? "Unassigned",
        priority,
        status,
        dueDate: dueDate || "TBD",
      });
      showToast(isAr ? "تم حفظ التغييرات بنجاح" : "Changes saved successfully", "success");
      onClose();
    } catch (err) {
      const msg = parseFirestoreError(err, isAr);
      setError(msg);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={task !== null}
      onClose={handleClose}
      title={isAr ? "تعديل المهمة" : "Edit task"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "عنوان المهمة" : "Task title"}
            <span className="text-[var(--rose)]"> *</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isAr ? "وصف المهمة بإيجاز" : "Brief task description"}
            required
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </div>

        {/* Status */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "الحالة" : "Status"}
          </label>
          <div className="flex gap-2">
            {(["todo", "in-progress", "done"] as Task["status"][]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="flex-1 rounded-2xl border px-3 py-2.5 text-xs font-medium transition"
                style={{
                  borderColor: status === s ? "var(--accent)" : "var(--border)",
                  background:
                    status === s
                      ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                      : "var(--glass-overlay)",
                  color: status === s ? "var(--accent)" : "var(--muted)",
                }}
              >
                {isAr
                  ? s === "todo"
                    ? "للعمل"
                    : s === "in-progress"
                    ? "قيد التنفيذ"
                    : "مكتمل"
                  : s === "todo"
                  ? "To do"
                  : s === "in-progress"
                  ? "In progress"
                  : "Done"}
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "الأولوية" : "Priority"}
          </label>
          <div className="flex gap-2">
            {(["low", "medium", "high"] as Task["priority"][]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className="flex-1 rounded-2xl border px-3 py-2.5 text-xs font-medium transition"
                style={{
                  borderColor: priority === p ? "var(--accent)" : "var(--border)",
                  background:
                    priority === p
                      ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                      : "var(--glass-overlay)",
                  color: priority === p ? "var(--accent)" : "var(--muted)",
                }}
              >
                {isAr
                  ? p === "low"
                    ? "منخفضة"
                    : p === "medium"
                    ? "متوسطة"
                    : "عالية"
                  : p === "low"
                  ? "Low"
                  : p === "medium"
                  ? "Medium"
                  : "High"}
              </button>
            ))}
          </div>
        </div>

        {/* Assignee */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "المسؤول" : "Assignee"}
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          >
            <option value="">{isAr ? "— غير معيّن —" : "— Unassigned —"}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Client */}
        {clients.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">
              {isAr ? "العميل" : "Client"}
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
            >
              <option value="">{isAr ? "— بدون عميل —" : "— No client —"}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Due date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "الموعد النهائي" : "Due date"}
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </div>

        {error ? (
          <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2.5 text-sm text-[var(--muted)] transition hover:opacity-80"
          >
            {isAr ? "إلغاء" : "Cancel"}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <Save size={16} />
            {loading
              ? isAr
                ? "جارٍ الحفظ…"
                : "Saving…"
              : isAr
              ? "حفظ التغييرات"
              : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
