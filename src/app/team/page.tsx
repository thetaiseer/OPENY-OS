"use client";

import { useState } from "react";
import { Activity, Plus, ShieldCheck, Sparkles, Users, Workflow, Trash2, Edit } from "lucide-react";
import { useAppStore, useTeam } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { AddMemberModal } from "@/components/ui/AddMemberModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import {
  BarListChart,
  EmptyPanel,
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function TeamPage() {
  const { members, deleteMember } = useTeam();
  const { tasks, activities } = useAppStore();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteMember(id);
      showToast(isArabic ? "تم حذف العضو بنجاح" : "Team member deleted successfully", "success");
    } catch {
      showToast(isArabic ? "فشل حذف العضو" : "Failed to delete member", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const activeMembers = members.filter((member) => member.status === "active").length;
  const awayMembers = members.filter((member) => member.status === "away").length;
  const workload = members.map((member) => ({
    label: member.name,
    value: tasks.filter((task) => task.assigneeId === member.id && task.status !== "done").length,
    meta: member.role,
  })).sort((a, b) => b.value - a.value);

  return (
    <PageMotion>
      <AddMemberModal open={showAddMember} onClose={() => setShowAddMember(false)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف العضو" : "Delete member"}
        message={isArabic ? "هل أنت متأكد من حذف هذا العضو؟ سيتم إلغاء إسناد مهامه." : "Are you sure you want to delete this member? Their task assignments will be removed."}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <PageHeader
        eyebrow={pageText("People operations", "عمليات الفريق")}
        title={pageText("Team cockpit rebuilt", "إعادة بناء قمرة الفريق")}
        description={pageText(
          "A clean premium surface for team visibility, active workload, and operating pulse.",
          "واجهة فاخرة ونظيفة لرؤية الفريق وعبء العمل النشط والنبض التشغيلي."
        )}
        actions={
          <button
            type="button"
            onClick={() => setShowAddMember(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            <Plus size={16} />
            {isArabic ? "إضافة عضو" : "Add member"}
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Members", "الأعضاء")} value={members.length} hint={pageText("Everyone in the workspace", "كل من في مساحة العمل")} icon={Users} tone="blue" />
        <StatCard label={pageText("Active", "النشطون")} value={activeMembers} hint={pageText("Currently online or available", "متصلون أو متاحون حاليًا")} icon={ShieldCheck} tone="mint" />
        <StatCard label={pageText("Away", "غير متاح")} value={awayMembers} hint={pageText("Members temporarily idle", "أعضاء غير متاحين مؤقتًا")} icon={Activity} tone="amber" />
        <StatCard label={pageText("Open assignments", "التكليفات المفتوحة")} value={tasks.filter((task) => task.status !== "done").length} hint={pageText("Tasks still in motion", "المهام التي ما زالت قيد التنفيذ")} icon={Workflow} tone="violet" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title={pageText("Team directory", "دليل الفريق")} description={pageText("Fresh member cards with role and activity status.", "بطاقات أعضاء جديدة مع الدور والحالة.")}
          action={<InfoBadge label={isArabic ? `${members.length} عضو` : `${members.length} members`} tone="blue" />}>
          {members.length === 0 ? (
            <EmptyPanel title={pageText("No team members yet", "لا يوجد أعضاء فريق بعد")} description={pageText("Invited or created team members will appear here automatically.", "أعضاء الفريق المدعوون أو المضافون سيظهرون هنا تلقائيًا.")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {members.map((member) => (
                <article key={member.id} className="glass-panel rounded-[24px] border border-[var(--border)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white" style={{ background: member.color }}>
                        {member.initials}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text)]">{member.name}</h3>
                        <p className="text-sm text-[var(--muted)]">{member.role}</p>
                      </div>
                    </div>
                    <ActionMenu
                      items={[
                        { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: () => {} },
                        { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(member.id) },
                      ]}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoBadge label={member.status} tone={member.status === "active" ? "mint" : member.status === "away" ? "amber" : "slate"} />
                    <InfoBadge label={`${tasks.filter((task) => task.assigneeId === member.id && task.status !== "done").length} ${isArabic ? "نشط" : "active"}`} tone="violet" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={pageText("Workload map", "خريطة عبء العمل")} description={pageText("Assignments by team member in real time.", "التكليفات حسب كل عضو في الزمن الحقيقي.")}>
          {workload.length === 0 ? <EmptyPanel title={pageText("No active workload", "لا يوجد عبء عمل نشط")} description={pageText("Assign tasks to team members and they will appear here instantly.", "عيّن المهام لأعضاء الفريق وستظهر هنا فورًا.")} /> : <BarListChart items={workload} tone="violet" />}
        </Panel>
      </section>

      <Panel title={pageText("Recent activity", "النشاط الأخير")} description={pageText("The latest operational events involving the team.", "أحدث الأحداث التشغيلية التي تخص الفريق.")}>
        <div className="space-y-3">
          {activities.slice(0, 8).map((activity) => (
            <article key={activity.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                <Sparkles size={14} className="text-[var(--accent)]" />
                {new Date(activity.timestamp).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
              </div>
              <h3 className="mt-2 text-sm font-semibold text-[var(--text)]">{activity.message}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{activity.detail}</p>
            </article>
          ))}
          {activities.length === 0 ? <EmptyPanel title={pageText("No activity available", "لا يوجد نشاط متاح")} description={pageText("Activity from tasks, members, and publishing will stream here once available.", "سيظهر النشاط من المهام والأعضاء والنشر هنا عند توفره.")} /> : null}
        </div>
      </Panel>
    </PageMotion>
  );
}
