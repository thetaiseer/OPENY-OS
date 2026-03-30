"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { useTeam, useClients } from "@/lib/AppContext";
import { useRecurringTasks } from "@/lib/RecurringTaskContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { RecurringTaskTemplate, WorkflowStep } from "@/lib/types";

interface AddRecurringTaskModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddRecurringTaskModal({ open, onClose }: AddRecurringTaskModalProps) {
  const { createTemplate } = useRecurringTasks();
  const { members } = useTeam();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isAr = language === "ar";

  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState<RecurringTaskTemplate["priority"]>("medium");
  const [frequency, setFrequency] = useState<RecurringTaskTemplate["frequency"]>("monthly");
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setTitle("");
    setAssigneeId("");
    setClientId("");
    setPriority("medium");
    setFrequency("monthly");
    setSteps([]);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { order: prev.length, label: "", assigneeId: "", assigneeName: "" },
    ]);
  };

  const updateStep = (idx: number, field: keyof WorkflowStep, value: string | number) => {
    setSteps((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        if (field === "assigneeId") {
          const member = members.find((m) => m.id === value);
          return { ...s, assigneeId: String(value), assigneeName: member?.name ?? "" };
        }
        return { ...s, [field]: value };
      })
    );
  };

  const removeStep = (idx: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(isAr ? "عنوان القالب مطلوب" : "Template title is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const assignee = members.find((m) => m.id === assigneeId);
      await createTemplate({
        title: title.trim(),
        clientId: clientId || undefined,
        assigneeId: assigneeId || undefined,
        assigneeName: assignee?.name,
        priority,
        frequency,
        workflowSteps: steps.length > 0 ? steps : undefined,
      });
      reset();
      onClose();
    } catch {
      setError(isAr ? "حدث خطأ، يرجى المحاولة مرة أخرى" : "Something went wrong, please try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title={isAr ? "إضافة مهمة متكررة" : "Add recurring task"}>
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
            placeholder={isAr ? "مثال: تقرير شهري" : "e.g. Monthly report"}
            required
            className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
          />
        </div>

        {/* Frequency */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">
            {isAr ? "التكرار" : "Frequency"}
          </label>
          <div className="flex gap-2">
            {(["monthly", "weekly"] as RecurringTaskTemplate["frequency"][]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFrequency(f)}
                className="flex-1 rounded-2xl border px-3 py-2.5 text-xs font-medium transition"
                style={{
                  borderColor: frequency === f ? "var(--accent)" : "var(--border)",
                  background: frequency === f
                    ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                    : "var(--glass-overlay)",
                  color: frequency === f ? "var(--accent)" : "var(--muted)",
                }}
              >
                {isAr ? (f === "monthly" ? "شهري" : "أسبوعي") : (f === "monthly" ? "Monthly" : "Weekly")}
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
            {(["low", "medium", "high"] as RecurringTaskTemplate["priority"][]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className="flex-1 rounded-2xl border px-3 py-2.5 text-xs font-medium transition"
                style={{
                  borderColor: priority === p ? "var(--accent)" : "var(--border)",
                  background: priority === p
                    ? "linear-gradient(135deg, rgba(106,168,255,0.18), rgba(169,139,255,0.14))"
                    : "var(--glass-overlay)",
                  color: priority === p ? "var(--accent)" : "var(--muted)",
                }}
              >
                {isAr
                  ? p === "low" ? "منخفضة" : p === "medium" ? "متوسطة" : "عالية"
                  : p === "low" ? "Low" : p === "medium" ? "Medium" : "High"}
              </button>
            ))}
          </div>
        </div>

        {/* Default Assignee (only shown if no workflow steps) */}
        {steps.length === 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--muted)]">
              {isAr ? "المسؤول الافتراضي" : "Default assignee"}
            </label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="glass-input w-full rounded-2xl px-4 py-3 text-sm"
            >
              <option value="">{isAr ? "— غير معيّن —" : "— Unassigned —"}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Workflow Steps */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[var(--muted)]">
              {isAr ? "خطوات سير العمل (اختياري)" : "Workflow steps (optional)"}
            </label>
            <button
              type="button"
              onClick={addStep}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:opacity-80"
            >
              <Plus size={12} />
              {isAr ? "إضافة خطوة" : "Add step"}
            </button>
          </div>
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] p-3">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[10px] font-bold text-white">
                {idx + 1}
              </span>
              <input
                type="text"
                value={step.label}
                onChange={(e) => updateStep(idx, "label", e.target.value)}
                placeholder={isAr ? "اسم الخطوة (مثال: تصميم)" : "Step label (e.g. Design)"}
                className="glass-input flex-1 rounded-xl px-3 py-2 text-xs"
              />
              <select
                value={step.assigneeId}
                onChange={(e) => updateStep(idx, "assigneeId", e.target.value)}
                className="glass-input flex-1 rounded-xl px-3 py-2 text-xs"
              >
                <option value="">{isAr ? "— اختر —" : "— Select —"}</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeStep(idx)}
                className="rounded-xl border border-[var(--border)] p-2 text-[var(--muted)] transition hover:text-[var(--rose)]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {steps.length > 0 && (
            <p className="text-[11px] text-[var(--muted)]">
              {isAr
                ? "عند اكتمال كل خطوة، تنتقل المهمة تلقائياً للخطوة التالية."
                : "When each step is completed, the task advances to the next step automatically."}
            </p>
          )}
        </div>

        {error ? (
          <p className="rounded-2xl bg-[rgba(255,143,159,0.12)] px-4 py-3 text-sm text-[var(--rose)]">{error}</p>
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
            <Plus size={16} />
            {loading
              ? (isAr ? "جارٍ الإضافة…" : "Adding…")
              : (isAr ? "إضافة قالب" : "Add template")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
