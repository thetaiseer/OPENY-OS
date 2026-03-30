"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Plus, Workflow, Zap, Trash2, Edit } from "lucide-react";
import { useTasks, useTeam } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { AddTaskModal } from "@/components/ui/AddTaskModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import {
  BarListChart,
  ButtonLink,
  DonutChart,
  EmptyPanel,
  InfoBadge,
  KanbanBoard,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function TasksPage() {
  const { tasks, toggleTaskDone, deleteTask } = useTasks();
  const { members } = useTeam();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [showAddTask, setShowAddTask] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteTask = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTask(id);
      showToast(isArabic ? "تم حذف المهمة بنجاح" : "Task deleted successfully", "success");
    } catch {
      showToast(isArabic ? "فشل حذف المهمة" : "Failed to delete task", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const inProgress = tasks.filter((task) => task.status === "in-progress").length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const overdue = tasks.filter((task) => task.status !== "done" && task.dueDate && !Number.isNaN(new Date(task.dueDate).getTime()) && new Date(task.dueDate) < new Date()).length;

  const columns = [
    { id: "todo", title: isArabic ? "للعمل" : "To do", items: tasks.filter((task) => task.status === "todo") },
    { id: "doing", title: isArabic ? "قيد التنفيذ" : "In progress", items: tasks.filter((task) => task.status === "in-progress") },
    { id: "done", title: isArabic ? "مكتمل" : "Done", items: tasks.filter((task) => task.status === "done") },
  ];

  const workload = members.map((member) => ({
    label: member.name,
    value: tasks.filter((task) => task.assigneeId === member.id && task.status !== "done").length,
    meta: member.role,
  })).filter((item) => item.value > 0);

  const deadlineList = [...tasks]
    .filter((task) => task.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  return (
    <PageMotion>
      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف المهمة" : "Delete task"}
        message={isArabic ? "هل أنت متأكد من حذف هذه المهمة نهائيًا؟" : "Are you sure you want to permanently delete this task?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDeleteTask(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <PageHeader
        eyebrow={pageText("Task management", "إدارة المهام")}
        title={pageText("Tasks", "المهام")}
        description={pageText(
          "Track, assign, and manage tasks across all status stages.",
          "تتبع وتعيين وإدارة المهام عبر جميع مراحل التنفيذ."
        )}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="touch-target inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
            >
              <Plus size={16} />
              {isArabic ? "إضافة مهمة" : "Add task"}
            </button>
            <ButtonLink href="/team" label={pageText("Open team view", "افتح عرض الفريق")} tone="mint" />
          </>
        }
      />

      <section className="stat-grid">
        <StatCard label={pageText("Open tasks", "المهام المفتوحة")} value={openTasks} hint={pageText("Anything not yet completed", "كل ما لم يكتمل بعد")} icon={Workflow} tone="blue" />
        <StatCard label={pageText("In progress", "قيد التنفيذ")} value={inProgress} hint={pageText("Currently moving through the team", "تتحرك الآن داخل الفريق")} icon={Zap} tone="violet" />
        <StatCard label={pageText("Completed", "المكتمل")} value={doneTasks} hint={pageText("Finished workload", "العمل المنجز")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Overdue", "المتأخر")} value={overdue} hint={pageText("Missed deadlines requiring attention", "مواعيد فائتة تحتاج إلى انتباه")} icon={Clock3} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title={pageText("Completion health", "صحة الإنجاز")} description={pageText("Track finished work versus the full backlog.", "تابع الإنجاز مقابل كامل قائمة العمل.")}
          action={<InfoBadge label={isArabic ? `${doneTasks}/${tasks.length || 0} مكتمل` : `${doneTasks}/${tasks.length || 0} completed`} tone="mint" />}>
          <DonutChart value={doneTasks} total={tasks.length || 1} tone="mint" label={isArabic ? "إنجاز" : "Completion"} />
        </Panel>

        <Panel title={pageText("Team workload", "عبء الفريق")} description={pageText("Live assignment pressure based on active tasks.", "ضغط التعيينات المباشر بناءً على المهام النشطة.")}
          action={<InfoBadge label={isArabic ? `${members.length} عضو` : `${members.length} members`} tone="blue" />}>
          {workload.length === 0 ? <EmptyPanel title={pageText("No active allocations", "لا توجد توزيعات نشطة")} description={pageText("Once tasks are assigned to team members, their live workload appears here.", "عند تعيين المهام لأعضاء الفريق سيظهر عبؤهم المباشر هنا.")} /> : <BarListChart items={workload} tone="violet" />}
        </Panel>
      </section>

      <Panel title={pageText("Task board", "لوحة المهام")} description={pageText("Manage tasks across todo, active, and completed states.", "إدارة المهام عبر حالات المعلق والنشط والمنجز.")}
        action={<InfoBadge label={isArabic ? `${tasks.length} مهمة` : `${tasks.length} tasks`} tone="blue" />}>
        {tasks.length === 0 ? (
          <EmptyPanel title={pageText("No tasks in the workspace", "لا توجد مهام في مساحة العمل")} description={pageText("Create tasks from your workflow and they will appear here automatically.", "أنشئ مهام من سير العمل وستظهر هنا تلقائيًا.")} />
        ) : (
          <KanbanBoard
            columns={columns}
            renderItem={(task) => (
              <article className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--text)]">{task.title}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">{task.assigneeName || task.assignee || (isArabic ? "غير معيّن" : "Unassigned")}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <InfoBadge label={task.priority} tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "mint"} />
                    <ActionMenu
                      items={[
                        { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: () => {} },
                        { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(task.id) },
                      ]}
                      size={16}
                    />
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                  <span>{task.dueDate || (isArabic ? "بدون موعد" : "No deadline")}</span>
                  <button
                    type="button"
                    onClick={() => toggleTaskDone(task.id)}
                    className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--text)] transition hover:bg-[var(--glass-overlay)]"
                  >
                    {task.status === "done" ? (isArabic ? "إعادة فتح" : "Re-open") : (isArabic ? "تمييز كمكتمل" : "Mark done")}
                  </button>
                </div>
              </article>
            )}
          />
        )}
      </Panel>

      <Panel title={pageText("Upcoming deadlines", "المواعيد القادمة")} description={pageText("Chronological visibility for the next tasks that need attention.", "رؤية زمنية للمهام التالية التي تحتاج اهتمامًا.")}>
        <div className="space-y-3">
          {deadlineList.map((task) => (
            <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">{task.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{task.assigneeName || task.assignee || (isArabic ? "غير معيّن" : "Unassigned")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <InfoBadge label={task.dueDate || (isArabic ? "بدون موعد" : "No deadline")} tone="slate" />
                <InfoBadge label={task.status} tone={task.status === "done" ? "mint" : task.status === "in-progress" ? "violet" : "amber"} />
              </div>
            </div>
          ))}
          {deadlineList.length === 0 ? <EmptyPanel title={pageText("No deadlines available", "لا توجد مواعيد متاحة")} description={pageText("Tasks with due dates will appear here automatically.", "المهام ذات المواعيد النهائية ستظهر هنا تلقائيًا.")} /> : null}
        </div>
      </Panel>
    </PageMotion>
  );
}
