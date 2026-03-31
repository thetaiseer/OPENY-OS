"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Sparkles,
  Trash2,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { useAppStore, useActivities } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { usePublishing } from "@/lib/PublishingContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import type { ContentStatus } from "@/lib/types";
import {
  BarListChart,
  ButtonLink,
  CalendarHeatmap,
  EmptyPanel,
  InfoBadge,
  KanbanBoard,
  MiniAreaChart,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const BOARD_COLUMNS: Array<{ id: string; title: { en: string; ar: string }; statuses: ContentStatus[] }> = [
  { id: "strategy", title: { en: "Strategy", ar: "الاستراتيجية" }, statuses: ["idea", "draft", "copywriting"] },
  { id: "production", title: { en: "Production", ar: "الإنتاج" }, statuses: ["design", "in_progress", "internal_review"] },
  { id: "review", title: { en: "Review", ar: "المراجعة" }, statuses: ["client_review", "approved"] },
  { id: "delivery", title: { en: "Delivery", ar: "التسليم" }, statuses: ["scheduled", "publishing_ready", "published"] },
] as const;

export default function DashboardPage() {
  const { clients, tasks, members } = useAppStore();
  const { activities, clearActivities } = useActivities();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { getDueNowItems, getThisWeekItems } = usePublishing();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const scheduledThisWeek = getThisWeekItems(contentItems).length;
  const dueNow = getDueNowItems(contentItems).length;
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending_internal" || approval.status === "pending_client").length;
  const weeklySeries = Array.from({ length: 8 }, (_, index) => {
    const edge = new Date();
    edge.setDate(edge.getDate() - (7 - index) * 7);
    return contentItems.filter((item) => new Date(item.createdAt) >= edge).length;
  });

  const platformStats = ["Instagram", "LinkedIn", "TikTok", "Facebook", "YouTube", "X"].map((platform) => ({
    label: platform,
    value: contentItems.filter((item) => item.platform === platform).length,
    meta: isArabic ? "منشورات مرتبطة" : "connected items",
  }));

  const heatmapEntries = contentItems
    .filter((item) => item.scheduledDate)
    .reduce<Array<{ date: string; value: number }>>((acc, item) => {
      const found = acc.find((entry) => entry.date === item.scheduledDate);
      if (found) found.value += 1;
      else acc.push({ date: item.scheduledDate, value: 1 });
      return acc;
    }, []);

  const boardColumns = BOARD_COLUMNS.map((column) => ({
    id: column.id,
    title: isArabic ? column.title.ar : column.title.en,
    items: contentItems.filter((item) => column.statuses.includes(item.status)).slice(0, 4),
  }));

  const now = new Date();
  const hour = now.getHours();
  const greeting = isArabic
    ? (hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور")
    : (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  const dateLabel = now.toLocaleDateString(isArabic ? "ar-EG" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <PageMotion>
      {/* Hero greeting */}
      <section
        className="relative overflow-hidden rounded-2xl border px-6 py-8 sm:px-8 sm:py-10"
        style={{
          background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)",
          borderColor: "transparent",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div className="relative z-10">
          <p className="text-sm font-medium text-white/70">{dateLabel}</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">
            {greeting}! {isArabic ? "إليك نظرة عامة على مساحة عملك" : "Here's your workspace overview."}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
            {isArabic
              ? `لديك ${pendingApprovals} موافقات معلقة و${scheduledThisWeek} عنصر مجدول هذا الأسبوع.`
              : `You have ${pendingApprovals} pending approval${pendingApprovals !== 1 ? "s" : ""} and ${scheduledThisWeek} item${scheduledThisWeek !== 1 ? "s" : ""} scheduled this week.`}
          </p>
        </div>
        {/* Decorative circles */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 right-24 h-32 w-32 rounded-full"
          style={{ background: "rgba(255,255,255,0.05)" }}
        />
      </section>

      {/* Stat cards — 2×2 on mobile, 4×1 on xl */}
      <section className="stat-grid">
        <StatCard label={pageText("Clients", "العملاء")} value={clients.length} hint={pageText("Active relationships and prospects", "العلاقات النشطة والعملاء المحتملون")} icon={BriefcaseBusiness} tone="blue" />
        <StatCard label={pageText("Task completion", "إنجاز المهام")} value={`${completedTasks}/${tasks.length || 0}`} hint={pageText("Finished versus total workload", "المكتمل مقارنة بإجمالي العمل")} icon={Workflow} tone="mint" />
        <StatCard label={pageText("Publishing this week", "النشر هذا الأسبوع")} value={scheduledThisWeek} hint={pageText("Scheduled content in pipeline", "المحتوى المجدول ضمن خط الإنتاج")} icon={CalendarRange} tone="violet" />
        <StatCard label={pageText("Pending approvals", "الموافقات المعلقة")} value={pendingApprovals} hint={pageText("Items waiting on review", "عناصر بانتظار المراجعة")} icon={Clock3} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title={pageText("Operations overview", "نظرة على العمليات")} description={pageText("Eight-point trend for recently created content and campaigns.", "مؤشر من ثماني نقاط للمحتوى والحملات التي تم إنشاؤها مؤخرًا.")}
          action={<InfoBadge label={isArabic ? `${dueNow} مستحق الآن` : `${dueNow} due now`} tone={dueNow > 0 ? "amber" : "mint"} />}>
          <MiniAreaChart values={weeklySeries} tone="blue" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <QuickMetric label={isArabic ? "الفريق" : "Team"} value={members.length} />
            <QuickMetric label={isArabic ? "المحتوى" : "Content"} value={contentItems.length} />
            <QuickMetric label={isArabic ? "الأنشطة" : "Activity"} value={activities.length} />
          </div>
        </Panel>

        <Panel title={pageText("Channel distribution", "توزيع القنوات")} description={pageText("Content distribution across platforms.", "توزيع المحتوى عبر المنصات.")}
          action={<InfoBadge label={isArabic ? "بيانات حية" : "Live data"} tone="violet" />}>
          <BarListChart items={platformStats} tone="violet" />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Panel title={pageText("Content board", "لوحة المحتوى")} description={pageText("A kanban snapshot of your current content pipeline.", "لقطة كانبان من خط إنتاج المحتوى الحالي.")}>
          {contentItems.length === 0 ? (
            <EmptyPanel title={pageText("No content yet", "لا يوجد محتوى بعد")} description={pageText("Add content items to see them here across all pipeline stages.", "أضف عناصر محتوى لتظهر هنا عبر جميع مراحل خط الإنتاج.")} />
          ) : (
            <KanbanBoard
              columns={boardColumns}
              renderItem={(item) => (
                <article className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{item.platform} · {item.contentType}</p>
                    </div>
                    <InfoBadge label={item.priority} tone={item.priority === "high" ? "rose" : item.priority === "medium" ? "amber" : "mint"} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-[var(--muted)]">{item.caption || (isArabic ? "لا يوجد وصف بعد" : "No caption yet")}</p>
                </article>
              )}
            />
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title={pageText("Publishing calendar", "تقويم النشر")} description={pageText("Schedule density for the active month.", "كثافة الجدولة للشهر النشط.")}
            action={<InfoBadge label={isArabic ? `${scheduledThisWeek} هذا الأسبوع` : `${scheduledThisWeek} this week`} tone="mint" />}>
            <CalendarHeatmap entries={heatmapEntries} />
          </Panel>

          <Panel title={pageText("Latest activity", "آخر الأنشطة")} description={pageText("Recent updates from activities and approvals.", "أحدث التحديثات من الأنشطة والموافقات.")}
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
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">
                    <Sparkles size={14} className="text-[var(--accent)]" />
                    {new Date(activity.timestamp).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                  </div>
                  <p className="mt-2 text-sm font-medium text-[var(--text)]">{activity.message}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{activity.detail}</p>
                </div>
              ))}
              {activities.length === 0 ? <EmptyPanel title={pageText("No activity yet", "لا توجد أنشطة بعد")} description={pageText("Activity events from clients, tasks, and publishing will stream here automatically.", "ستظهر هنا تلقائيًا أحداث العملاء والمهام والنشر.")} /> : null}
            </div>
          </Panel>

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
                showToast(isArabic ? "تم مسح سجل الأنشطة" : "Activity history cleared", "success");
              } catch (err) {
                showToast(`${isArabic ? "فشل مسح السجل" : "Failed to clear history"}: ${parseFirestoreError(err, isArabic)}`, "error");
              } finally {
                setConfirmClear(false);
                setClearing(false);
              }
            }}
            onCancel={() => setConfirmClear(false)}
          />
        </div>
      </section>

      <Panel title={pageText("Quick actions", "إجراءات سريعة")} description={pageText("Jump directly into key workspace sections.", "انتقل مباشرة إلى أقسام مساحة العمل الرئيسية.")}>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Shortcut href="/content" title={isArabic ? "المحتوى" : "Content"} description={isArabic ? "كانبان وتقويم وتحليلات النشر" : "Kanban, calendar, and publishing analytics"} icon={Sparkles} />
          <Shortcut href="/publishing" title={isArabic ? "النشر" : "Publishing"} description={isArabic ? "إدارة الجدولة والنشر" : "Manage scheduling and publishing"} icon={CheckCircle2} />
          <Shortcut href="/clients" title={isArabic ? "العملاء" : "Clients"} description={isArabic ? "إدارة حسابات العملاء والمهام" : "Manage client accounts and workload"} icon={TrendingUp} />
        </div>
      </Panel>
    </PageMotion>
  );
}

function QuickMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}

function Shortcut({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: typeof Sparkles }) {
  return (
    <Link href={href} className="glass-panel rounded-[24px] border border-[var(--border)] p-5 transition duration-200 hover:-translate-y-1">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.18),rgba(169,139,255,0.18))] text-[var(--accent)]">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
