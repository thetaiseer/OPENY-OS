"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Sparkles,
  TrendingUp,
  Workflow,
} from "lucide-react";
import { useAppStore } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { usePublishing } from "@/lib/PublishingContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { ContentStatus } from "@/lib/types";
import {
  BarListChart,
  ButtonLink,
  CalendarHeatmap,
  EmptyPanel,
  InfoBadge,
  KanbanBoard,
  MiniAreaChart,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

const BOARD_COLUMNS: Array<{ id: string; title: { en: string; ar: string }; statuses: ContentStatus[] }> = [
  { id: "strategy", title: { en: "Strategy", ar: "الاستراتيجية" }, statuses: ["idea", "draft", "copywriting"] },
  { id: "production", title: { en: "Production", ar: "الإنتاج" }, statuses: ["design", "in_progress", "internal_review"] },
  { id: "review", title: { en: "Review", ar: "المراجعة" }, statuses: ["client_review", "approved"] },
  { id: "delivery", title: { en: "Delivery", ar: "التسليم" }, statuses: ["scheduled", "publishing_ready", "published"] },
] as const;

export default function DashboardPage() {
  const { clients, tasks, members, activities } = useAppStore();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { getDueNowItems, getThisWeekItems } = usePublishing();
  const { language } = useLanguage();
  const isArabic = language === "ar";

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

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Premium operating system", "نظام تشغيل فاخر")}
        title={pageText("SaaS command center", "مركز قيادة SaaS")}
        description={pageText(
          "A fully refreshed control surface for operations, planning, approvals, and analytics — all driven live from Firebase collections.",
          "واجهة تحكم جديدة بالكامل لإدارة العمليات، التخطيط، الموافقات، والتحليلات مع بيانات مباشرة من Firebase."
        )}
        actions={<ButtonLink href="/reports" label={pageText("Open analytics", "افتح التحليلات")} tone="violet" />}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Clients", "العملاء")} value={clients.length} hint={pageText("Active relationships and prospects", "العلاقات النشطة والعملاء المحتملون")} icon={BriefcaseBusiness} tone="blue" />
        <StatCard label={pageText("Task completion", "إنجاز المهام")} value={`${completedTasks}/${tasks.length || 0}`} hint={pageText("Finished versus total workload", "المكتمل مقارنة بإجمالي العمل")} icon={Workflow} tone="mint" />
        <StatCard label={pageText("Publishing this week", "النشر هذا الأسبوع")} value={scheduledThisWeek} hint={pageText("Scheduled content in pipeline", "المحتوى المجدول ضمن خط الإنتاج")} icon={CalendarRange} tone="violet" />
        <StatCard label={pageText("Pending approvals", "الموافقات المعلقة")} value={pendingApprovals} hint={pageText("Items waiting on review", "عناصر بانتظار المراجعة")} icon={Clock3} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title={pageText("Operations momentum", "زخم العمليات")} description={pageText("Eight-point signal for recently created content and campaigns.", "إشارة من ثماني نقاط للمحتوى والحملات التي تم إنشاؤها مؤخرًا.")}
          action={<InfoBadge label={isArabic ? `${dueNow} مستحق الآن` : `${dueNow} due now`} tone={dueNow > 0 ? "amber" : "mint"} />}>
          <MiniAreaChart values={weeklySeries} tone="blue" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <QuickMetric label={isArabic ? "الفريق" : "Team"} value={members.length} />
            <QuickMetric label={isArabic ? "المحتوى" : "Content"} value={contentItems.length} />
            <QuickMetric label={isArabic ? "الأنشطة الأخيرة" : "Recent activity"} value={activities.length} />
          </div>
        </Panel>

        <Panel title={pageText("Channel mix", "مزيج القنوات")} description={pageText("Distribution of content load across channels.", "توزيع عبء المحتوى عبر القنوات المختلفة.")}
          action={<InfoBadge label={isArabic ? "حي من Firebase" : "Live from Firebase"} tone="violet" />}>
          <BarListChart items={platformStats} tone="violet" />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
        <Panel title={pageText("Production board preview", "معاينة لوحة الإنتاج")} description={pageText("A condensed kanban snapshot of your current content pipeline.", "لقطة كانبان مختصرة لخط إنتاج المحتوى الحالي.")}>
          {contentItems.length === 0 ? (
            <EmptyPanel title={pageText("No content connected yet", "لا يوجد محتوى متصل بعد")} description={pageText("Once Firebase content items arrive, this board will visualize planning, production, approvals, and publishing stages.", "عند وصول عناصر المحتوى من Firebase ستعرض هذه اللوحة مراحل التخطيط والإنتاج والموافقة والنشر.")} />
          ) : (
            <KanbanBoard
              columns={boardColumns}
              renderItem={(item) => (
                <article className="rounded-[22px] border border-white/8 bg-white/[0.04] p-4">
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

          <Panel title={pageText("Latest signals", "آخر الإشارات")} description={pageText("Realtime highlights from activity and approvals.", "أبرز التحديثات المباشرة من الأنشطة والموافقات.")}>
            <div className="space-y-3">
              {activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
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
        </div>
      </section>

      <Panel title={pageText("Executive shortcuts", "اختصارات تنفيذية")} description={pageText("Jump directly into planning, delivery, and reporting flows.", "انتقل مباشرة إلى التخطيط والتنفيذ ومسارات التقارير.")}>
        <div className="grid gap-4 md:grid-cols-3">
          <Shortcut href="/content" title={isArabic ? "لوحة المحتوى" : "Content workspace"} description={isArabic ? "كانبان، تقويم، وتحليلات نشر" : "Kanban, calendar, and publishing analytics"} icon={Sparkles} />
          <Shortcut href="/publishing" title={isArabic ? "مركز النشر" : "Publishing hub"} description={isArabic ? "التنبيهات، الجاهزية، والجدولة" : "Due alerts, readiness, and scheduling"} icon={CheckCircle2} />
          <Shortcut href="/clients" title={isArabic ? "مساحات العملاء" : "Client spaces"} description={isArabic ? "صحة الحسابات والحصص والمهام" : "Account health, quotas, and workload"} icon={TrendingUp} />
        </div>
      </Panel>
    </PageMotion>
  );
}

function QuickMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--text)]">{value}</div>
    </div>
  );
}

function Shortcut({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: typeof Sparkles }) {
  return (
    <Link href={href} className="glass-panel rounded-[24px] border border-white/10 p-5 transition duration-200 hover:-translate-y-1">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.18),rgba(169,139,255,0.18))] text-[var(--accent)]">
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{description}</p>
    </Link>
  );
}
