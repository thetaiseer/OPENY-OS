"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Clock3, Plus, Trash2 } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { AddTaskModal } from "@/components/ui/AddTaskModal";
import { EditTaskModal } from "@/components/ui/EditTaskModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { EmptyPanel, InfoBadge, PageMotion, Panel, pageText } from "@/components/redesign/ui";
import { Edit, Eye } from "lucide-react";

const STATUS_COLORS = {
  todo:        { bg: "rgba(100,116,139,0.12)", color: "#64748b" },
  "in-progress": { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  done:        { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
};

const PRIORITY_COLORS = {
  low:    { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  medium: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  high:   { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
  urgent: { bg: "rgba(220,38,38,0.15)",  color: "#dc2626" },
};

export default function ClientTasksPage() {
  const params = useParams();
  const { clients } = useClients();
  const { tasks, toggleTaskDone, deleteTask } = useTasks();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === "ar";

  const [showAdd, setShowAdd]               = useState(false);
  const [editTask, setEditTask]             = useState(null);
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [deleting, setDeleting]             = useState(false);
  const [statusFilter, setStatusFilter]     = useState("all");

  const client      = clients.find((c) => c.id === params.id);
  const clientTasks = tasks.filter((t) => t.clientId === params.id);

  const filteredTasks =
    statusFilter === "all"
      ? clientTasks
      : clientTasks.filter((t) => t.status === statusFilter);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTask(id);
      showToast(isArabic ? "تم حذف المهمة" : "Task deleted", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف المهمة" : "Failed to delete task"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const STATUS_FILTERS = [
    { value: "all",         label: isArabic ? "الكل"          : "All"         },
    { value: "todo",        label: isArabic ? "للعمل"         : "To Do"       },
    { value: "in-progress", label: isArabic ? "قيد التنفيذ"  : "In Progress" },
    { value: "done",        label: isArabic ? "مكتمل"         : "Done"        },
  ];

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("", "")} />
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <AddTaskModal open={showAdd} onClose={() => setShowAdd(false)} defaultClientId={params.id as string} />
      <EditTaskModal task={editTask} onClose={() => setEditTask(null)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف المهمة" : "Delete task"}
        message={isArabic ? "هل أنت متأكد من حذف هذه المهمة؟" : "Are you sure you want to delete this task?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Panel
        title={pageText("Client tasks", "مهام العميل")}
        description={pageText(
          "All tasks linked to this client.",
          "جميع المهام المرتبطة بهذا العميل."
        )}
        action={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <InfoBadge
              label={isArabic ? `${clientTasks.filter((t) => t.status !== "done").length} مفتوحة` : `${clientTasks.filter((t) => t.status !== "done").length} open`}
              tone="amber"
            />
            <InfoBadge
              label={isArabic ? `${clientTasks.length} إجمالي` : `${clientTasks.length} total`}
              tone="blue"
            />
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                color: "white", borderRadius: 10, padding: "7px 14px",
                fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              }}
            >
              <Plus size={13} />
              {isArabic ? "مهمة جديدة" : "New task"}
            </button>
          </div>
        }
      >
        {/* Status filter pills */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              style={{
                borderRadius: 20, padding: "5px 14px", fontSize: 12, fontWeight: 500,
                cursor: "pointer", border: "1px solid",
                borderColor: statusFilter === f.value ? "var(--accent)" : "var(--border)",
                background: statusFilter === f.value ? "var(--accent)" : "var(--glass-overlay)",
                color: statusFilter === f.value ? "white" : "var(--text-muted)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredTasks.length === 0 ? (
          <EmptyPanel
            title={pageText("No tasks found", "لا توجد مهام")}
            description={pageText(
              "Add a task to start tracking work for this client.",
              "أضف مهمة لبدء تتبع العمل لهذا العميل."
            )}
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filteredTasks.map((task) => {
              const sc = STATUS_COLORS[task.status] ?? STATUS_COLORS.todo;
              const pc = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium;
              return (
                <article
                  key={task.id}
                  style={{
                    borderRadius: 14, border: "1px solid var(--border)",
                    background: "var(--panel)", padding: "14px 16px",
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 600, color: "var(--text)",
                        margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {task.title}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                        {task.assigneeName || task.assignee || (isArabic ? "غير معيّن" : "Unassigned")}
                        {task.dueDate && ` · ${task.dueDate}`}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: sc.bg, color: sc.color }}>
                        {isArabic
                          ? task.status === "done" ? "مكتمل" : task.status === "in-progress" ? "قيد التنفيذ" : "للعمل"
                          : task.status}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: pc.bg, color: pc.color }}>
                        {isArabic
                          ? task.priority === "high" ? "عالية" : task.priority === "urgent" ? "عاجل" : task.priority === "medium" ? "متوسطة" : "منخفضة"
                          : task.priority}
                      </span>
                      <ActionMenu
                        items={[
                          { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: () => setEditTask(task) },
                          { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(task.id) },
                        ]}
                        size={15}
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-muted)" }}>
                      <Clock3 size={11} />
                      {task.dueDate || (isArabic ? "بدون موعد" : "No deadline")}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleTaskDone(task.id)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        borderRadius: 20, border: "1px solid var(--border)",
                        padding: "5px 12px", fontSize: 12, fontWeight: 500,
                        background: "var(--glass-overlay)", color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      <CheckCircle2 size={12} />
                      {task.status === "done"
                        ? (isArabic ? "إعادة فتح" : "Re-open")
                        : (isArabic ? "تمييز كمكتمل" : "Mark done")}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}
