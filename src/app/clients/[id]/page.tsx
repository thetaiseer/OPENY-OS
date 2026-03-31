"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Image as ImageIcon,
  Mail,
  Phone,
  Sparkles,
  StickyNote,
  Workflow,
  CalendarDays,
  FolderOpen,
  LayoutGrid,
  CheckSquare,
  Trash2,
  ClipboardCheck,
} from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useAssets } from "@/lib/AssetsContext";
import { useClientNotes } from "@/lib/ClientNotesContext";
import { useBank } from "@/lib/BankContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ContentCalendar } from "@/components/content/ContentCalendar";
import { ContentModal } from "@/components/content/ContentModal";
import type { ContentItem } from "@/lib/types";
import {
  ButtonLink,
  DetailRow,
  DonutChart,
  EmptyPanel,
  InfoBadge,
  MetricList,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

type Tab = "overview" | "content" | "tasks" | "approvals" | "notes";

const TABS: { id: Tab; labelEn: string; labelAr: string; icon: React.ElementType }[] = [
  { id: "overview",  labelEn: "Overview",  labelAr: "نظرة عامة",  icon: LayoutGrid },
  { id: "content",   labelEn: "Content",   labelAr: "المحتوى",    icon: CalendarDays },
  { id: "tasks",     labelEn: "Tasks",     labelAr: "المهام",     icon: CheckSquare },
  { id: "approvals", labelEn: "Approvals", labelAr: "الموافقات",  icon: ClipboardCheck },
  { id: "notes",     labelEn: "Notes",     labelAr: "الملاحظات",  icon: StickyNote },
];

export default function ClientWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { clients } = useClients();
  const { tasks, toggleTaskDone, deleteTask } = useTasks();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { filtered: assets, deleteAsset } = useAssets(params.id);
  const { filtered: notes } = useClientNotes(params.id);
  const { filtered: bankEntries } = useBank(params.id);
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === "ar";
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<string | null>(null);
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const client = clients.find((entry) => entry.id === params.id);

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("No client record matches this ID.", "لا يوجد سجل عميل يطابق هذا المعرّف.")} />
      </PageMotion>
    );
  }

  const clientTasks = tasks.filter((task) => task.clientId === client.id);
  const clientContent = contentItems.filter((item) => item.clientId === client.id);
  const clientApprovals = approvals.filter((approval) => approval.clientId === client.id);
  const published = clientContent.filter((item) => item.status === "published").length;
  const quota = 30;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthTasks = clientTasks.filter(
    (t) => t.createdAt && t.createdAt.startsWith(currentMonth)
  );

  const handleDeleteTask = async (id: string) => {
    setDeleting(true);
    try {
      await deleteTask(id);
      showToast(isArabic ? "تم حذف المهمة" : "Task deleted", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف المهمة" : "Failed to delete task"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDeleteTask(null);
      setDeleting(false);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    setDeleting(true);
    try {
      await deleteAsset(id);
      showToast(isArabic ? "تم حذف الملف" : "Asset deleted", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف الملف" : "Failed to delete asset"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDeleteAsset(null);
      setDeleting(false);
    }
  };

  return (
    <PageMotion>
      {selectedContent && (
        <ContentModal open={true} item={selectedContent} onClose={() => setSelectedContent(null)} />
      )}
      <ConfirmDialog
        open={confirmDeleteTask !== null}
        title={isArabic ? "حذف المهمة" : "Delete task"}
        message={isArabic ? "هل أنت متأكد من حذف هذه المهمة؟" : "Are you sure you want to delete this task?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDeleteTask && handleDeleteTask(confirmDeleteTask)}
        onCancel={() => setConfirmDeleteTask(null)}
      />
      <ConfirmDialog
        open={confirmDeleteAsset !== null}
        title={isArabic ? "حذف الملف" : "Delete asset"}
        message={isArabic ? "هل أنت متأكد من حذف هذا الملف؟" : "Are you sure you want to delete this asset?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDeleteAsset && handleDeleteAsset(confirmDeleteAsset)}
        onCancel={() => setConfirmDeleteAsset(null)}
      />

      {/* Back link + action */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm font-medium text-[var(--text)] transition hover:bg-[var(--bg)]"
          style={{ boxShadow: "var(--shadow-xs)" }}
        >
          <ArrowLeft size={15} />
          {isArabic ? "← العودة للعملاء" : "← Back to clients"}
        </Link>
        <ButtonLink href="/content" label={pageText("Open planning", "افتح التخطيط")} tone="violet" />
      </div>

      {/* Client profile card */}
      <div
        className="flex flex-wrap items-center gap-5 rounded-2xl p-5"
        style={{ background: "var(--panel)", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
      >
        <div
          className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl text-xl font-bold text-white"
          style={{ background: client.color ?? "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
        >
          {client.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>{client.name}</h1>
            <InfoBadge
              label={client.status}
              tone={client.status === "active" ? "mint" : client.status === "prospect" ? "amber" : "slate"}
            />
          </div>
          {client.company && <p className="mt-0.5 text-sm" style={{ color: "var(--muted)" }}>{client.company}</p>}
          <div className="mt-2 flex flex-wrap gap-4 text-sm" style={{ color: "var(--muted)" }}>
            {client.email && (
              <span className="inline-flex items-center gap-1.5"><Mail size={13} />{client.email}</span>
            )}
            {client.phone && (
              <span className="inline-flex items-center gap-1.5"><Phone size={13} />{client.phone}</span>
            )}
          </div>
        </div>
      </div>

      <PageHeader
        eyebrow={pageText("Client workspace", "مساحة العميل")}
        title={{ en: client.name, ar: client.name }}
        description={pageText(
          "Delivery overview, content, tasks, approvals, and notes for this client.",
          "نظرة عامة على التسليم والمحتوى والمهام والموافقات والملاحظات لهذا العميل."
        )}
      />

      {/* Tab nav */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-1.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition"
              style={{
                background: isActive ? "var(--panel)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--muted)",
                boxShadow: isActive ? "var(--shadow-xs)" : "none",
                border: isActive ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <Icon size={15} />
              {isArabic ? tab.labelAr : tab.labelEn}
            </button>
          );
        })}
      </div>

      {/* ── Overview Tab ── */}
      {activeTab === "overview" && (
        <section className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label={pageText("Content", "المحتوى")} value={clientContent.length} hint={pageText("All items linked to this account", "كل العناصر المرتبطة بهذا الحساب")} icon={Sparkles} tone="blue" />
            <StatCard label={pageText("Open tasks", "المهام المفتوحة")} value={clientTasks.filter((task) => task.status !== "done").length} hint={pageText("Execution load for the team", "عبء التنفيذ على الفريق")} icon={Workflow} tone="amber" />
            <StatCard label={pageText("Approvals", "الموافقات")} value={clientApprovals.length} hint={pageText("Workflow checkpoints", "نقاط التحقق في سير العمل")} icon={BarChart3} tone="violet" />
            <StatCard label={pageText("Assets", "الأصول")} value={assets.length} hint={pageText("Media and brand files", "الوسائط وملفات الهوية")} icon={ImageIcon} tone="mint" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            <Panel title={pageText("Delivery quota", "حصة التسليم")} description={pageText("Published content against a default monthly plan.", "المحتوى المنشور مقابل خطة شهرية افتراضية.")}
              action={<InfoBadge label={isArabic ? `${published}/${quota} منشور` : `${published}/${quota} published`} tone="mint" />}>
              <DonutChart value={published} total={quota} tone="mint" label={isArabic ? "الحصة" : "Quota"} />
            </Panel>
            <Panel title={pageText("Operational snapshot", "لقطة تشغيلية")} description={pageText("A concise overview of content, notes, assets, and copy banks.", "نظرة مختصرة على المحتوى، الملاحظات، الأصول، وبنوك النصوص.")}>
              <MetricList
                items={[
                  { label: isArabic ? "المحتوى المجدول" : "Scheduled content", value: clientContent.filter((item) => item.scheduledDate).length },
                  { label: isArabic ? "المحتوى المنشور" : "Published content", value: published },
                  { label: isArabic ? "الملاحظات" : "Notes", value: notes.length },
                  { label: isArabic ? "بنك النصوص" : "Bank entries", value: bankEntries.length },
                  { label: isArabic ? "الأصول" : "Assets", value: assets.length },
                ]}
              />
            </Panel>
          </section>
        </section>
      )}

      {/* ── Content Tab ── */}
      {activeTab === "content" && (
        <Panel
          title={pageText("Monthly content plan", "الخطة الشهرية للمحتوى")}
          description={pageText(
            "A calendar view of all scheduled posts for this client. Click a post to see details.",
            "عرض تقويمي لجميع المنشورات المجدولة لهذا العميل. انقر على منشور لرؤية تفاصيله."
          )}
          action={<InfoBadge label={isArabic ? `${clientContent.filter((i) => i.scheduledDate).length} مجدول` : `${clientContent.filter((i) => i.scheduledDate).length} scheduled`} tone="violet" />}
        >
          {clientContent.length === 0 ? (
            <EmptyPanel
              title={pageText("No content yet", "لا يوجد محتوى بعد")}
              description={pageText(
                "Add content items linked to this client to see the monthly publish plan.",
                "أضف عناصر محتوى مرتبطة بهذا العميل لرؤية خطة النشر الشهرية."
              )}
            />
          ) : (
            <ContentCalendar items={clientContent} onItemClick={(item) => setSelectedContent(item)} />
          )}
        </Panel>
      )}

      {/* ── Tasks Tab ── */}
      {activeTab === "tasks" && (
        <Panel
          title={pageText("Client tasks", "مهام العميل")}
          description={pageText("All tasks linked to this client, filtered for the current month.", "جميع المهام المرتبطة بهذا العميل، مصنفة حسب الشهر الحالي.")}
          action={
            <div className="flex items-center gap-2">
              <InfoBadge label={isArabic ? `${currentMonthTasks.length} هذا الشهر` : `${currentMonthTasks.length} this month`} tone="amber" />
              <InfoBadge label={isArabic ? `${clientTasks.length} إجمالي` : `${clientTasks.length} total`} tone="blue" />
            </div>
          }
        >
          {clientTasks.length === 0 ? (
            <EmptyPanel
              title={pageText("No tasks linked", "لا توجد مهام مرتبطة")}
              description={pageText("Tasks assigned to this client will appear here in real time.", "المهام المرتبطة بهذا العميل ستظهر هنا فوراً.")}
            />
          ) : (
            <div className="space-y-3">
              {currentMonthTasks.length > 0 && (
                <div className="mb-2">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                    {isArabic ? "مهام الشهر الحالي" : "Current month tasks"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {currentMonthTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isArabic={isArabic}
                        onToggle={() => toggleTaskDone(task.id)}
                        onDelete={() => setConfirmDeleteTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {clientTasks.filter((t) => !t.createdAt?.startsWith(currentMonth)).length > 0 && (
                <div>
                  <p className="mb-3 mt-4 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
                    {isArabic ? "مهام سابقة" : "Previous tasks"}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {clientTasks
                      .filter((t) => !t.createdAt?.startsWith(currentMonth))
                      .map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          isArabic={isArabic}
                          onToggle={() => toggleTaskDone(task.id)}
                          onDelete={() => setConfirmDeleteTask(task.id)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      )}

      {/* ── Approvals Tab ── */}
      {activeTab === "approvals" && (
        <Panel
          title={pageText("Client approvals", "موافقات العميل")}
          description={pageText("Approval workflow checkpoints for this client's content.", "نقاط التحقق في سير الموافقات لمحتوى هذا العميل.")}
          action={<InfoBadge label={isArabic ? `${clientApprovals.length} إجمالي` : `${clientApprovals.length} total`} tone="violet" />}
        >
          {clientApprovals.length === 0 ? (
            <EmptyPanel
              title={pageText("No approvals yet", "لا توجد موافقات بعد")}
              description={pageText("Approval requests for this client will appear here.", "طلبات الموافقة الخاصة بهذا العميل ستظهر هنا.")}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {clientApprovals.map((approval) => {
                const contentItem = clientContent.find((c) => c.id === approval.contentItemId);
                return (
                  <article key={approval.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4" style={{ boxShadow: "var(--shadow-xs)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[var(--text)]">
                          {contentItem?.title || (isArabic ? "محتوى غير معروف" : "Unknown content")}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          {isArabic ? "معيّن إلى:" : "Assigned to:"} {approval.assignedTo || (isArabic ? "غير معيّن" : "Unassigned")}
                        </p>
                      </div>
                      <InfoBadge
                        label={approval.status.replace(/_/g, " ")}
                        tone={
                          approval.status === "approved" ? "mint"
                          : approval.status === "rejected" ? "rose"
                          : approval.status === "revision_requested" ? "amber"
                          : "slate"
                        }
                      />
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                      {new Date(approval.createdAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* ── Notes Tab ── */}
      {activeTab === "notes" && (
        <Panel
          title={pageText("Notes stream", "سجل الملاحظات")}
          description={pageText("Internal and client-facing notes.", "الملاحظات الداخلية والموجهة للعميل.")}
          action={<InfoBadge label={isArabic ? `${notes.length} ملاحظة` : `${notes.length} notes`} tone="blue" />}
        >
          {notes.length === 0 ? (
            <EmptyPanel
              title={pageText("No notes available", "لا توجد ملاحظات متاحة")}
              description={pageText("Notes added through the workspace are displayed here immediately.", "الملاحظات المضافة عبر مساحة العمل تظهر هنا مباشرة.")}
            />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <article key={note.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4" style={{ boxShadow: "var(--shadow-xs)" }}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text)]">
                      <StickyNote size={15} />{note.author}
                    </div>
                    <InfoBadge label={note.type} tone={note.type === "internal" ? "amber" : "mint"} />
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{note.content}</p>
                </article>
              ))}
            </div>
          )}
        </Panel>
      )}
    </PageMotion>
  );
}

// ── Inline task card ──────────────────────────────────────────

function TaskCard({
  task,
  isArabic,
  onToggle,
  onDelete,
}: {
  task: import("@/lib/types").Task;
  isArabic: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4" style={{ boxShadow: "var(--shadow-xs)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--text)]">{task.title}</h3>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {task.assigneeName || task.assignee || (isArabic ? "غير معيّن" : "Unassigned")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <InfoBadge label={task.priority} tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "mint"} />
          {task.workflowSteps && task.workflowSteps.length > 0 && (
            <InfoBadge
              label={`${(task.workflowIndex ?? 0) + 1}/${task.workflowSteps.length}`}
              tone="violet"
            />
          )}
          <ActionMenu
            items={[
              { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger" as const, onClick: onDelete },
            ]}
            size={16}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>{task.dueDate || (isArabic ? "بدون موعد" : "No deadline")}</span>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-full border border-[var(--border)] px-3 py-1.5 text-[var(--text)] transition hover:bg-[var(--bg)]"
        >
          {task.status === "done"
            ? (isArabic ? "إعادة فتح" : "Re-open")
            : (isArabic ? "تمييز كمكتمل" : "Mark done")}
        </button>
      </div>
      {task.workflowSteps && task.workflowSteps.length > 0 && (
        <div className="mt-3 flex items-center gap-1 overflow-x-auto">
          {task.workflowSteps.map((step, i) => (
            <span
              key={i}
              className="inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                background: i === (task.workflowIndex ?? 0)
                  ? "rgba(169,139,255,0.18)"
                  : i < (task.workflowIndex ?? 0)
                  ? "rgba(61,217,180,0.12)"
                  : "rgba(151,163,189,0.1)",
                color: i === (task.workflowIndex ?? 0)
                  ? "#a98bff"
                  : i < (task.workflowIndex ?? 0)
                  ? "#3dd9b4"
                  : "var(--muted)",
              }}
            >
              {i < (task.workflowIndex ?? 0) ? "✓ " : ""}{step.label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
