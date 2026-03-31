"use client";

import { useState } from "react";
import { Activity, Plus, ShieldCheck, Sparkles, Users, Workflow, Trash2, Edit } from "lucide-react";
import { useAppStore, useTeam, useActivities } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { AddMemberModal } from "@/components/ui/AddMemberModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
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
  const { tasks } = useAppStore();
  const { activities, clearActivities } = useActivities();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [showAddMember, setShowAddMember] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteMember(id);
      showToast(isArabic ? "تم حذف العضو بنجاح" : "Team member deleted successfully", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف العضو" : "Failed to delete member"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
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
        eyebrow={pageText("People operations", "إدارة الفريق")}
        title={pageText("Team", "الفريق")}
        description={pageText(
          "Manage team members, roles, and workload.",
          "إدارة أعضاء الفريق وأدوارهم وعبء العمل."
        )}
        actions={
          <button
            type="button"
            onClick={() => setShowAddMember(true)}
            className="touch-target inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
          >
            <Plus size={16} />
            {isArabic ? "إضافة عضو" : "Add member"}
          </button>
        }
      />

      <section className="stat-grid">
        <StatCard label={pageText("Members", "الأعضاء")} value={members.length} hint={pageText("Everyone in the workspace", "كل من في مساحة العمل")} icon={Users} tone="blue" />
        <StatCard label={pageText("Active", "النشطون")} value={activeMembers} hint={pageText("Currently online or available", "متصلون أو متاحون حاليًا")} icon={ShieldCheck} tone="mint" />
        <StatCard label={pageText("Away", "غير متاح")} value={awayMembers} hint={pageText("Members temporarily idle", "أعضاء غير متاحين مؤقتًا")} icon={Activity} tone="amber" />
        <StatCard label={pageText("Open assignments", "التكليفات المفتوحة")} value={tasks.filter((task) => task.status !== "done").length} hint={pageText("Tasks still in motion", "المهام التي ما زالت قيد التنفيذ")} icon={Workflow} tone="violet" />
      </section>

      <Panel
        title={pageText("Team directory", "دليل الفريق")}
        description={pageText("Member cards with role, status, and contact info.", "بطاقات الأعضاء مع الدور والحالة ومعلومات الاتصال.")}
        action={<InfoBadge label={isArabic ? `${members.length} عضو` : `${members.length} members`} tone="blue" />}
      >
        {members.length === 0 ? (
          <EmptyPanel title={pageText("No team members yet", "لا يوجد أعضاء فريق بعد")} description={pageText("Invited or created team members will appear here automatically.", "أعضاء الفريق المدعوون أو المضافون سيظهرون هنا تلقائيًا.")} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => {
              const initials = member.initials ?? member.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              const bgColor = member.color ?? "var(--accent)";
              const activeTasks = tasks.filter((task) => task.assigneeId === member.id && task.status !== "done").length;
              return (
                <article key={member.id} className="glass-panel flex flex-col rounded-2xl border border-[var(--border)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-white" style={{ background: bgColor }}>
                      {initials}
                    </div>
                    <ActionMenu
                      items={[
                        { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: () => {} },
                        { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(member.id) },
                      ]}
                    />
                  </div>
                  <div className="mt-3">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{member.name}</h3>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{member.email}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <InfoBadge label={member.role} tone="blue" />
                    <InfoBadge label={member.status} tone={member.status === "active" ? "mint" : member.status === "away" ? "amber" : "slate"} />
                    <InfoBadge label={`${activeTasks} ${isArabic ? "مهمة" : "tasks"}`} tone="violet" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title={pageText("Workload map", "خريطة عبء العمل")} description={pageText("Open task assignments by team member.", "التكليفات المفتوحة حسب كل عضو.")}>
          {workload.length === 0 ? <EmptyPanel title={pageText("No active workload", "لا يوجد عبء عمل نشط")} description={pageText("Assign tasks to team members and they will appear here instantly.", "عيّن المهام لأعضاء الفريق وستظهر هنا فورًا.")} /> : <BarListChart items={workload} tone="violet" />}
        </Panel>

        <Panel title={pageText("Recent activity", "النشاط الأخير")} description={pageText("The latest operational events involving the team.", "أحدث الأحداث التشغيلية التي تخص الفريق.")}
          action={
            activities.length > 0 ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 rounded-2xl border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--rose)] hover:border-[var(--rose)]"
              >
                <Trash2 size={13} />
                {isArabic ? "مسح السجل" : "Clear history"}
              </button>
            ) : undefined
          }>
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
      </section>

      <ConfirmDialog
        open={confirmClear}
        title={isArabic ? "مسح سجل الأنشطة" : "Clear activity history"}
        message={isArabic ? "هل أنت متأكد من مسح كل بيانات سجل الأنشطة؟ لا يمكن التراجع عن هذا الإجراء." : "Are you sure you want to delete all activity history? This action cannot be undone."}
        confirmLabel={isArabic ? "مسح الكل" : "Clear all"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={clearing}
        onConfirm={async () => {
          setClearing(true);
          try {
            await clearActivities();
            setConfirmClear(false);
            showToast(isArabic ? "تم مسح سجل الأنشطة" : "Activity history cleared", "success");
          } catch (err) {
            showToast(`${isArabic ? "فشل مسح السجل" : "Failed to clear history"}: ${parseFirestoreError(err, isArabic)}`, "error");
          } finally {
            setClearing(false);
          }
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </PageMotion>
  );
}
