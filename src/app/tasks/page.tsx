"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Edit, Pause, Play, Plus, RefreshCw, Trash2, Workflow, Zap } from "lucide-react";
import { useTasks, useTeam } from "@/lib/AppContext";
import { useRecurringTasks } from "@/lib/RecurringTaskContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { AddTaskModal } from "@/components/ui/AddTaskModal";
import { EditTaskModal } from "@/components/ui/EditTaskModal";
import { AddRecurringTaskModal } from "@/components/ui/AddRecurringTaskModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import type { Task } from "@/lib/types";
import {
  BarListChart,
  ButtonLink,
  DonutChart,
  EmptyPanel,
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  SegmentedControl,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

type StatusFilter = "all" | "todo" | "in-progress" | "done";

const PRIORITY_CONFIG = {
  high: { color: "var(--rose)", label: { en: "High Priority", ar: "أولوية عالية" } },
  urgent: { color: "#dc2626", label: { en: "Urgent", ar: "عاجل" } },
  medium: { color: "var(--amber)", label: { en: "Medium Priority", ar: "أولوية متوسطة" } },
  low: { color: "var(--mint)", label: { en: "Low Priority", ar: "أولوية منخفضة" } },
} as const;

type PriorityKey = keyof typeof PRIORITY_CONFIG;

const STATUS_OPTIONS = [
  { value: "all" as StatusFilter, label: pageText("All", "الكل") },
  { value: "todo" as StatusFilter, label: pageText("To do", "للعمل") },
  { value: "in-progress" as StatusFilter, label: pageText("In progress", "قيد التنفيذ") },
  { value: "done" as StatusFilter, label: pageText("Done", "مكتمل") },
];

function AssigneeAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
      style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
      title={name}
    >
      {initials}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  isArabic: boolean;
  priorityColor: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function TaskRow({ task, isArabic, priorityColor, onEdit, onDelete, onToggle }: TaskRowProps) {
  const isDone = task.status === "done";
  const assigneeName = task.assigneeName || task.assignee || "";
  return (
    <div className="card card-hover flex items-center gap-3 px-4 py-3">
      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: priorityColor }} />
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{
            color: isDone ? "var(--muted)" : "var(--text)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.title}
        </p>
        {task.clientName && (
          <p className="text-xs" style={{ color: "var(--muted)" }}>{task.clientName}</p>
        )}
      </div>
      {assigneeName && <AssigneeAvatar name={assigneeName} />}
      {task.dueDate && (
        <span className="hidden sm:block text-xs flex-shrink-0" style={{ color: "var(--muted)" }}>
          {task.dueDate}
        </span>
      )}
      <InfoBadge
        label={task.status}
        tone={task.status === "done" ? "mint" : task.status === "in-progress" || task.status === "in_progress" ? "violet" : "amber"}
      />
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onToggle}
          className="hidden sm:flex h-7 w-7 items-center justify-center rounded-xl transition hover:bg-[var(--glass-overlay)]"
          style={{ color: "var(--muted)" }}
          title={isDone ? (isArabic ? "إعادة فتح" : "Reopen") : (isArabic ? "تمييز كمكتمل" : "Mark done")}
        >
          <CheckCircle2 size={15} />
        </button>
        <ActionMenu
          items={[
            { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: onEdit },
            { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: onDelete },
          ]}
          size={16}
        />
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { tasks, toggleTaskDone, deleteTask } = useTasks();
  const { members } = useTeam();
  const { templates, toggleTemplate, deleteTemplate, runMonthlyGeneration } = useRecurringTasks();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const handleDeleteTask = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTask(id);
      showToast(isArabic ? "تم حذف المهمة بنجاح" : "Task deleted successfully", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف المهمة" : "Failed to delete task"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTemplate(id);
      showToast(isArabic ? "تم حذف القالب" : "Template deleted", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف القالب" : "Failed to delete template"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDeleteTemplate(null);
      setDeleting(false);
    }
  };

  const handleRunGeneration = async () => {
    setGenerating(true);
    try {
      const { generated } = await runMonthlyGeneration();
      showToast(
        isArabic
          ? `تم إنشاء ${generated} مهمة من القوالب المتكررة`
          : `Generated ${generated} task(s) from recurring templates`,
        "success"
      );
    } catch (err) {
      showToast(`${isArabic ? "فشل إنشاء المهام" : "Failed to generate tasks"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setGenerating(false);
    }
  };

  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const inProgress = tasks.filter((task) => task.status === "in-progress" || task.status === "in_progress").length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const overdue = tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.dueDate &&
      !Number.isNaN(new Date(task.dueDate).getTime()) &&
      new Date(task.dueDate) < new Date()
  ).length;

  const workload = members
    .map((member) => ({
      label: member.name,
      value: tasks.filter((task) => task.assigneeId === member.id && task.status !== "done").length,
      meta: member.role,
    }))
    .filter((item) => item.value > 0);

  const deadlineList = [...tasks]
    .filter((task) => task.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "in-progress") return task.status === "in-progress" || task.status === "in_progress";
    return task.status === statusFilter;
  });

  const PRIORITY_ORDER: PriorityKey[] = ["urgent", "high", "medium", "low"];

  const priorityGroups = PRIORITY_ORDER.map((priority) => ({
    priority,
    tasks: filteredTasks.filter((task) => task.priority === priority),
  })).filter((group) => group.tasks.length > 0);

  const knownPriorities = new Set(PRIORITY_ORDER as string[]);
  const noPriorityTasks = filteredTasks.filter((task) => !knownPriorities.has(task.priority));

  return (
    <PageMotion>
      <AddTaskModal open={showAddTask} onClose={() => setShowAddTask(false)} />
      <AddRecurringTaskModal open={showAddRecurring} onClose={() => setShowAddRecurring(false)} />
      <EditTaskModal task={editTask} onClose={() => setEditTask(null)} />
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
      <ConfirmDialog
        open={confirmDeleteTemplate !== null}
        title={isArabic ? "حذف القالب المتكرر" : "Delete recurring template"}
        message={isArabic ? "هل أنت متأكد من حذف هذا القالب؟ لن يتم إنشاء مهام منه في المستقبل." : "Are you sure? No new tasks will be generated from this template."}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDeleteTemplate && handleDeleteTemplate(confirmDeleteTemplate)}
        onCancel={() => setConfirmDeleteTemplate(null)}
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
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))", color: "white", borderRadius: 12, padding: "10px 20px", fontSize: 14, fontWeight: 600 }}
            >
              + {isArabic ? "إضافة مهمة" : "Add Task"}
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
        <Panel
          title={pageText("Completion health", "صحة الإنجاز")}
          description={pageText("Track finished work versus the full backlog.", "تابع الإنجاز مقابل كامل قائمة العمل.")}
          action={<InfoBadge label={isArabic ? `${doneTasks}/${tasks.length || 0} مكتمل` : `${doneTasks}/${tasks.length || 0} completed`} tone="mint" />}
        >
          <DonutChart value={doneTasks} total={tasks.length || 1} tone="mint" label={isArabic ? "إنجاز" : "Completion"} />
        </Panel>

        <Panel
          title={pageText("Team workload", "عبء الفريق")}
          description={pageText("Live assignment pressure based on active tasks.", "ضغط التعيينات المباشر بناءً على المهام النشطة.")}
          action={<InfoBadge label={isArabic ? `${members.length} عضو` : `${members.length} members`} tone="blue" />}
        >
          {workload.length === 0 ? (
            <EmptyPanel
              title={pageText("No active allocations", "لا توجد توزيعات نشطة")}
              description={pageText("Once tasks are assigned to team members, their live workload appears here.", "عند تعيين المهام لأعضاء الفريق سيظهر عبؤهم المباشر هنا.")}
            />
          ) : (
            <BarListChart items={workload} tone="violet" />
          )}
        </Panel>
      </section>

      {/* Task List grouped by priority */}
      <Panel
        title={pageText("Task list", "قائمة المهام")}
        description={pageText("All tasks grouped by priority.", "جميع المهام مجمّعة حسب الأولوية.")}
        action={
          <div className="flex items-center gap-3">
            <InfoBadge label={isArabic ? `${filteredTasks.length} مهمة` : `${filteredTasks.length} tasks`} tone="blue" />
            <SegmentedControl
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={setStatusFilter}
            />
          </div>
        }
      >
        {filteredTasks.length === 0 ? (
          <EmptyPanel
            title={pageText("No tasks in the workspace", "لا توجد مهام في مساحة العمل")}
            description={pageText("Create tasks from your workflow and they will appear here automatically.", "أنشئ مهام من سير العمل وستظهر هنا تلقائيًا.")}
          />
        ) : (
          <div className="space-y-6">
            {priorityGroups.map(({ priority, tasks: groupTasks }) => {
              const config = PRIORITY_CONFIG[priority];
              return (
                <div key={priority}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: config.color }} />
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: config.color }}>
                      {isArabic ? config.label.ar : config.label.en}
                    </span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>({groupTasks.length})</span>
                  </div>
                  <div className="space-y-2">
                    {groupTasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        isArabic={isArabic}
                        priorityColor={config.color}
                        onEdit={() => setEditTask(task)}
                        onDelete={() => setConfirmDelete(task.id)}
                        onToggle={() => toggleTaskDone(task.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {noPriorityTasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: "var(--muted)" }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                    {isArabic ? "غير محدد" : "No Priority"} ({noPriorityTasks.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {noPriorityTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      isArabic={isArabic}
                      priorityColor="var(--muted)"
                      onEdit={() => setEditTask(task)}
                      onDelete={() => setConfirmDelete(task.id)}
                      onToggle={() => toggleTaskDone(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* Recurring Task Templates */}
      <Panel
        title={pageText("Recurring task templates", "قوالب المهام المتكررة")}
        description={pageText(
          "Define routine tasks that auto-generate at the start of each month or week.",
          "حدد المهام الروتينية التي تنشأ تلقائياً مع بداية كل شهر أو أسبوع."
        )}
        action={
          <InfoBadge label={isArabic ? `${templates.length} قالب` : `${templates.length} templates`} tone="violet" />
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddRecurring(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-2.5 text-sm text-[var(--text)] transition hover:opacity-80"
          >
            <Plus size={15} />
            {isArabic ? "إضافة قالب" : "Add template"}
          </button>
          <button
            type="button"
            onClick={handleRunGeneration}
            disabled={generating || templates.filter((t) => t.isActive).length === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw size={15} className={generating ? "animate-spin" : ""} />
            {isArabic ? "إنشاء مهام الشهر الحالي" : "Generate this month's tasks"}
          </button>
        </div>

        {templates.length === 0 ? (
          <EmptyPanel
            title={pageText("No recurring templates", "لا توجد قوالب متكررة")}
            description={pageText(
              "Add templates for tasks like monthly reports, shooting sessions, or weekly schedules.",
              "أضف قوالب للمهام مثل التقارير الشهرية، جلسات التصوير، أو الجداول الأسبوعية."
            )}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((tmpl) => (
              <article
                key={tmpl.id}
                className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4"
                style={{ opacity: tmpl.isActive ? 1 : 0.55 }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-[var(--text)]">{tmpl.title}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {tmpl.assigneeName || (isArabic ? "غير معيّن" : "Unassigned")}
                    </p>
                  </div>
                  <ActionMenu
                    items={[
                      {
                        label: tmpl.isActive ? (isArabic ? "إيقاف مؤقت" : "Pause") : (isArabic ? "تفعيل" : "Activate"),
                        icon: tmpl.isActive ? Pause : Play,
                        onClick: () => toggleTemplate(tmpl.id, !tmpl.isActive),
                      },
                      {
                        label: isArabic ? "حذف" : "Delete",
                        icon: Trash2,
                        tone: "danger",
                        onClick: () => setConfirmDeleteTemplate(tmpl.id),
                      },
                    ]}
                    size={16}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <InfoBadge
                    label={isArabic ? (tmpl.frequency === "monthly" ? "شهري" : "أسبوعي") : tmpl.frequency}
                    tone="blue"
                  />
                  <InfoBadge
                    label={tmpl.priority}
                    tone={tmpl.priority === "high" ? "rose" : tmpl.priority === "medium" ? "amber" : "mint"}
                  />
                  {tmpl.workflowSteps && tmpl.workflowSteps.length > 0 && (
                    <InfoBadge
                      label={isArabic ? `${tmpl.workflowSteps.length} خطوات` : `${tmpl.workflowSteps.length} steps`}
                      tone="violet"
                    />
                  )}
                  <InfoBadge
                    label={tmpl.isActive ? (isArabic ? "نشط" : "Active") : (isArabic ? "موقوف" : "Paused")}
                    tone={tmpl.isActive ? "mint" : "slate"}
                  />
                </div>
                {tmpl.lastGeneratedAt && (
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    {isArabic ? "آخر إنشاء:" : "Last generated:"}{" "}
                    {new Date(tmpl.lastGeneratedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={pageText("Upcoming deadlines", "المواعيد القادمة")}
        description={pageText("Chronological visibility for the next tasks that need attention.", "رؤية زمنية للمهام التالية التي تحتاج اهتمامًا.")}
      >
        <div className="space-y-3">
          {deadlineList.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4"
            >
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">{task.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {task.assigneeName || task.assignee || (isArabic ? "غير معيّن" : "Unassigned")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <InfoBadge label={task.dueDate || (isArabic ? "بدون موعد" : "No deadline")} tone="slate" />
                <InfoBadge
                  label={task.status}
                  tone={task.status === "done" ? "mint" : task.status === "in-progress" || task.status === "in_progress" ? "violet" : "amber"}
                />
              </div>
            </div>
          ))}
          {deadlineList.length === 0 && (
            <EmptyPanel
              title={pageText("No deadlines available", "لا توجد مواعيد متاحة")}
              description={pageText("Tasks with due dates will appear here automatically.", "المهام ذات المواعيد النهائية ستظهر هنا تلقائيًا.")}
            />
          )}
        </div>
      </Panel>

      {/* Mobile FAB */}
      <button
        type="button"
        onClick={() => setShowAddTask(true)}
        className="mobile-fab"
        aria-label={isArabic ? "إضافة مهمة" : "Add task"}
      >
        <Plus size={22} />
      </button>
    </PageMotion>
  );
}
