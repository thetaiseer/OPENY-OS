"use client";

import { useMemo, useState } from "react";
import { CalendarRange, KanbanSquare, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { useContentItems } from "@/lib/ContentContext";
import { usePublishing } from "@/lib/PublishingContext";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { AddContentModal } from "@/components/ui/AddContentModal";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { ContentStatus } from "@/lib/types";
import {
  BarListChart,
  CalendarHeatmap,
  EmptyPanel,
  InfoBadge,
  KanbanBoard,
  PageHeader,
  PageMotion,
  Panel,
  SegmentedControl,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

const VIEW_OPTIONS = [
  { value: "board", label: pageText("Kanban", "كانبان") },
  { value: "calendar", label: pageText("Calendar", "التقويم") },
  { value: "analytics", label: pageText("Analytics", "التحليلات") },
] as const;

export default function ContentPage() {
  const [view, setView] = useState<(typeof VIEW_OPTIONS)[number]["value"]>("board");
  const { contentItems, deleteContentItem } = useContentItems();
  const { getReadinessForItem } = usePublishing();
  const { clients } = useAppStore();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === "ar";

  const [showAddContent, setShowAddContent] = useState(false);
  const [confirmDeleteContent, setConfirmDeleteContent] = useState<string | null>(null);
  const [deletingContent, setDeletingContent] = useState(false);

  const handleDeleteContent = async (id: string) => {
    setDeletingContent(true);
    try {
      await deleteContentItem(id);
      showToast(isArabic ? "تم حذف المحتوى بنجاح" : "Content deleted successfully", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف المحتوى" : "Failed to delete content"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDeleteContent(null);
      setDeletingContent(false);
    }
  };

  const waitingReview = contentItems.filter((item) => item.status === "client_review" || item.status === "internal_review").length;
  const scheduled = contentItems.filter((item) => item.status === "scheduled" || item.status === "publishing_ready").length;
  const published = contentItems.filter((item) => item.status === "published").length;

  const backlogStatuses: ContentStatus[] = ["idea", "draft", "copywriting"];
  const studioStatuses: ContentStatus[] = ["design", "in_progress"];
  const approvalStatuses: ContentStatus[] = ["internal_review", "client_review", "approved"];
  const deliveryStatuses: ContentStatus[] = ["scheduled", "publishing_ready", "published", "failed"];

  const boardColumns = [
    { id: "backlog", title: isArabic ? "الاكتشاف" : "Discovery", items: contentItems.filter((item) => backlogStatuses.includes(item.status)) },
    { id: "studio", title: isArabic ? "الاستوديو" : "Studio", items: contentItems.filter((item) => studioStatuses.includes(item.status)) },
    { id: "approval", title: isArabic ? "الموافقات" : "Approvals", items: contentItems.filter((item) => approvalStatuses.includes(item.status)) },
    { id: "delivery", title: isArabic ? "الجدولة والتسليم" : "Scheduling & delivery", items: contentItems.filter((item) => deliveryStatuses.includes(item.status)) },
  ];

  const heatmapEntries = contentItems.reduce<Array<{ date: string; value: number }>>((acc, item) => {
    if (!item.scheduledDate) return acc;
    const hit = acc.find((entry) => entry.date === item.scheduledDate);
    if (hit) hit.value += 1;
    else acc.push({ date: item.scheduledDate, value: 1 });
    return acc;
  }, []);

  const readinessStats = [
    { label: isArabic ? "جاهز للنشر" : "Ready to publish", value: contentItems.filter((item) => getReadinessForItem(item) === "ready_to_publish").length },
    { label: isArabic ? "جاهز للجدولة" : "Ready to schedule", value: contentItems.filter((item) => getReadinessForItem(item) === "ready_to_schedule").length },
    { label: isArabic ? "يحتاج انتباه" : "Needs attention", value: contentItems.filter((item) => getReadinessForItem(item) === "needs_attention").length },
    { label: isArabic ? "غير جاهز" : "Not ready", value: contentItems.filter((item) => getReadinessForItem(item) === "not_ready").length },
  ];

  const platformStats = ["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube", "X"].map((platform) => ({
    label: platform,
    value: contentItems.filter((item) => item.platform === platform).length,
    meta: isArabic ? "عناصر في الخطة" : "items in plan",
  }));

  const upcoming = useMemo(
    () => [...contentItems].filter((item) => item.scheduledDate).sort((a, b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`)).slice(0, 8),
    [contentItems]
  );

  return (
    <PageMotion>
      <AddContentModal open={showAddContent} onClose={() => setShowAddContent(false)} />
      <ConfirmDialog
        open={confirmDeleteContent !== null}
        title={isArabic ? "حذف المحتوى" : "Delete content"}
        message={isArabic ? "هل أنت متأكد من حذف عنصر المحتوى هذا نهائيًا؟" : "Are you sure you want to permanently delete this content item?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deletingContent}
        onConfirm={() => confirmDeleteContent && handleDeleteContent(confirmDeleteContent)}
        onCancel={() => setConfirmDeleteContent(null)}
      />
      <PageHeader
        eyebrow={pageText("Planning workspace", "مساحة التخطيط")}
        title={pageText("Content planner", "مخطط المحتوى")}
        description={pageText(
          "Manage content across kanban, calendar, and analytics views.",
          "إدارة المحتوى عبر عروض الكانبان والتقويم والتحليلات."
        )}
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddContent(true)}
              className="touch-target inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
            >
              <Plus size={16} />
              {isArabic ? "إضافة محتوى" : "Add content"}
            </button>
            <SegmentedControl value={view} options={[...VIEW_OPTIONS]} onChange={setView} />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Content items", "عناصر المحتوى")} value={contentItems.length} hint={pageText("All content items", "جميع عناصر المحتوى")} icon={Sparkles} tone="blue" />
        <StatCard label={pageText("Review queue", "طابور المراجعة")} value={waitingReview} hint={pageText("Internal and client approvals", "مراجعات داخلية وموافقات العميل")} icon={Target} tone="amber" />
        <StatCard label={pageText("Scheduled", "المجدول")} value={scheduled} hint={pageText("Ready for launch windows", "جاهز لنوافذ الإطلاق")} icon={CalendarRange} tone="violet" />
        <StatCard label={pageText("Published", "المنشور")} value={published} hint={pageText("Delivered content already live", "محتوى تم تسليمه وأصبح مباشرًا")} icon={KanbanSquare} tone="mint" />
      </section>

      {view === "board" ? (
        <Panel title={pageText("Content board", "لوحة المحتوى")} description={pageText("Pipeline from draft to published, grouped by production stage.", "خط الإنتاج من المسودة إلى النشر، مجمّع حسب المرحلة.")}
          action={<InfoBadge label={isArabic ? `${clients.length} عميل مرتبط` : `${clients.length} connected clients`} tone="blue" />}>
          {contentItems.length === 0 ? (
            <EmptyPanel title={pageText("No content yet", "لا يوجد محتوى بعد")} description={pageText("Create your first content item to start planning.", "أنشئ أول عنصر محتوى للبدء في التخطيط.")} />
          ) : (
            <KanbanBoard
              columns={boardColumns}
              renderItem={(item) => (
                <article className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{clients.find((client) => client.id === item.clientId)?.name ?? (isArabic ? "عميل غير معروف" : "Unknown client")}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <InfoBadge label={item.platform} tone="violet" />
                      <ActionMenu
                        items={[
                          { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDeleteContent(item.id) },
                        ]}
                        size={14}
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--muted)] line-clamp-3">{item.caption || (isArabic ? "أضف وصفًا لتفعيل السياق التحريري" : "Add a caption to activate editorial context")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoBadge label={item.contentType} tone="slate" />
                    <InfoBadge label={item.priority} tone={item.priority === "high" ? "rose" : item.priority === "medium" ? "amber" : "mint"} />
                    <InfoBadge label={getReadinessForItem(item).replace(/_/g, " ")} tone={getReadinessForItem(item) === "ready_to_publish" ? "mint" : "amber"} />
                  </div>
                </article>
              )}
            />
          )}
        </Panel>
      ) : null}

      {view === "calendar" ? (
        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title={pageText("Publishing calendar", "تقويم النشر")} description={pageText("Calendar density for scheduled content this month.", "كثافة الجدولة للمحتوى المجدول خلال هذا الشهر.")}
            action={<InfoBadge label={isArabic ? `${scheduled} مواعيد نشطة` : `${scheduled} active dates`} tone="mint" />}>
            <CalendarHeatmap entries={heatmapEntries} />
          </Panel>
          <Panel title={pageText("Upcoming launches", "الإطلاقات القادمة")} description={pageText("Your next publishing windows sorted chronologically.", "نوافذ النشر القادمة مرتبة زمنيًا.")}>
            <div className="space-y-3">
              {upcoming.map((item) => (
                <div key={item.id} className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{clients.find((client) => client.id === item.clientId)?.name ?? (isArabic ? "غير محدد" : "Unassigned client")}</p>
                    </div>
                    <InfoBadge label={`${item.scheduledDate}${item.scheduledTime ? ` · ${item.scheduledTime}` : ""}`} tone="blue" />
                  </div>
                </div>
              ))}
              {upcoming.length === 0 ? <EmptyPanel title={pageText("No dates scheduled", "لا توجد مواعيد مجدولة")} description={pageText("As soon as content gets a scheduled date, it will appear here in order.", "بمجرد إضافة تاريخ للمحتوى سيظهر هنا بالترتيب.")} /> : null}
            </div>
          </Panel>
        </section>
      ) : null}

      {view === "analytics" ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <Panel title={pageText("Readiness analytics", "تحليلات الجاهزية")} description={pageText("Operational readiness across the publishing workflow.", "الجاهزية التشغيلية عبر مسار النشر.")}
            action={<InfoBadge label={isArabic ? "مباشر" : "Realtime"} tone="violet" />}>
            <BarListChart items={readinessStats.map((item) => ({ ...item, meta: isArabic ? "حالة إنتاج" : "production state" }))} tone="amber" />
          </Panel>
          <Panel title={pageText("Platform distribution", "توزيع المنصات")} description={pageText("See which channels are carrying the current plan.", "تعرف على القنوات التي تحمل الخطة الحالية.")}
            action={<InfoBadge label={isArabic ? `${platformStats.reduce((sum, item) => sum + item.value, 0)} عنصر` : `${platformStats.reduce((sum, item) => sum + item.value, 0)} items`} tone="blue" />}>
            <BarListChart items={platformStats} tone="violet" />
          </Panel>
        </section>
      ) : null}
    </PageMotion>
  );
}

