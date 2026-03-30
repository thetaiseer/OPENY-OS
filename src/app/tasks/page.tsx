"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Plus, Workflow, Zap } from "lucide-react";
import { useTasks, useTeam } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { AddTaskModal } from "@/components/ui/AddTaskModal";
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
  const { tasks, toggleTaskDone } = useTasks();
  const { members } = useTeam();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [showAddTask, setShowAddTask] = useState(false);

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
      <PageHeader
        eyebrow={pageText("Execution center", "مركز التنفيذ")}
        title={pageText("Task workflow rebuilt", "إعادة بناء سير المهام")}
        description={pageText(
          "A modern task surface with status lanes, deadline visibility, and team load visualization.",
          "واجهة مهام حديثة تعرض المسارات، المواعيد النهائية، وتوزيع عبء الفريق بصريًا."
        )}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddTask(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
            >
              <Plus size={16} />
              {isArabic ? "إضافة مهمة" : "Add task"}
            </button>
            <ButtonLink href="/team" label={pageText("Open team view", "افتح عرض الفريق")} tone="mint" />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <Panel title={pageText("Task lanes", "مسارات المهام")} description={pageText("An operational kanban across todo, active, and completed states.", "لوحة تشغيلية عبر حالات العمل والإنجاز.")}
        action={<InfoBadge label={isArabic ? "متصل ببيانات Firebase" : "Connected to Firebase"} tone="blue" />}>
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
                  <InfoBadge label={task.priority} tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "mint"} />
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
