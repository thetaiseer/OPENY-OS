"use client";

import { AlertTriangle, CalendarRange, Rocket, Zap } from "lucide-react";
import { usePublishing } from "@/lib/PublishingContext";
import { useContentItems } from "@/lib/ContentContext";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  BarListChart,
  CalendarHeatmap,
  EmptyPanel,
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function PublishingPage() {
  const { contentItems } = useContentItems();
  const { clients } = useClients();
  const { getDueNowItems, getTodayItems, getThisWeekItems, getFailedItems, getReadinessForItem } = usePublishing();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const dueNow = getDueNowItems(contentItems);
  const today = getTodayItems(contentItems);
  const thisWeek = getThisWeekItems(contentItems);
  const failed = getFailedItems(contentItems);
  const readiness = [
    { label: isArabic ? "جاهز للنشر" : "Ready to publish", value: contentItems.filter((item) => getReadinessForItem(item) === "ready_to_publish").length, meta: isArabic ? "جاهزية عالية" : "high readiness" },
    { label: isArabic ? "جاهز للجدولة" : "Ready to schedule", value: contentItems.filter((item) => getReadinessForItem(item) === "ready_to_schedule").length, meta: isArabic ? "بحاجة نافذة" : "needs slot" },
    { label: isArabic ? "يحتاج انتباه" : "Needs attention", value: contentItems.filter((item) => getReadinessForItem(item) === "needs_attention").length, meta: isArabic ? "ثغرات تشغيلية" : "operational gaps" },
    { label: isArabic ? "غير جاهز" : "Not ready", value: contentItems.filter((item) => getReadinessForItem(item) === "not_ready").length, meta: isArabic ? "بيانات ناقصة" : "missing data" },
  ];

  const heatmapEntries = contentItems.reduce<Array<{ date: string; value: number }>>((acc, item) => {
    if (!item.scheduledDate) return acc;
    const existing = acc.find((entry) => entry.date === item.scheduledDate);
    if (existing) existing.value += 1;
    else acc.push({ date: item.scheduledDate, value: 1 });
    return acc;
  }, []);

  const timeline = [...contentItems].filter((item) => item.scheduledDate).sort((a, b) => `${a.scheduledDate}${a.scheduledTime}`.localeCompare(`${b.scheduledDate}${b.scheduledTime}`)).slice(0, 10);

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Launch orchestration", "إدارة النشر")}
        title={pageText("Publishing", "النشر")}
        description={pageText(
          "Monitor due items, readiness, and scheduled launches.",
          "راقب العناصر المستحقة والجاهزية والإطلاقات المجدولة."
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Due now", "مستحق الآن")} value={dueNow.length} hint={pageText("Content at or past its release hour", "محتوى وصل أو تجاوز ساعة الإطلاق")} icon={Zap} tone="amber" />
        <StatCard label={pageText("Today", "اليوم")} value={today.length} hint={pageText("All items landing today", "كل العناصر المقرر إطلاقها اليوم")} icon={CalendarRange} tone="blue" />
        <StatCard label={pageText("This week", "هذا الأسبوع")} value={thisWeek.length} hint={pageText("Scheduled launches ahead", "الإطلاقات المجدولة القادمة")} icon={Rocket} tone="violet" />
        <StatCard label={pageText("Failed", "الفاشل")} value={failed.length} hint={pageText("Items that require intervention", "عناصر تحتاج إلى تدخل")} icon={AlertTriangle} tone="rose" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title={pageText("Readiness analytics", "تحليلات الجاهزية")} description={pageText("Directly derived from content completeness and approval state.", "مستمدة مباشرة من اكتمال المحتوى وحالة الموافقة.")}
          action={<InfoBadge label={isArabic ? `${contentItems.length} عنصر` : `${contentItems.length} items`} tone="violet" />}>
          <BarListChart items={readiness} tone="violet" />
        </Panel>

        <Panel title={pageText("Launch calendar", "تقويم الإطلاق")} description={pageText("Monthly release density for all scheduled content.", "كثافة الإطلاق الشهرية لكل المحتوى المجدول.")}>
          <CalendarHeatmap entries={heatmapEntries} />
        </Panel>
      </section>

      <Panel title={pageText("Publishing timeline", "الجدول الزمني للنشر")} description={pageText("A chronological lineup of upcoming launch windows.", "تسلسل زمني لنوافذ الإطلاق القادمة.")}>
        <div className="space-y-3">
          {timeline.map((item) => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{clients.find((client) => client.id === item.clientId)?.name || (isArabic ? "عميل غير معروف" : "Unknown client")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <InfoBadge label={`${item.scheduledDate}${item.scheduledTime ? ` · ${item.scheduledTime}` : ""}`} tone="blue" />
                <InfoBadge label={item.platform} tone="slate" />
                <InfoBadge label={item.status} tone={item.status === "published" ? "mint" : item.status === "failed" ? "rose" : "amber"} />
                <InfoBadge label={getReadinessForItem(item).replace(/_/g, " ")} tone={getReadinessForItem(item) === "ready_to_publish" ? "mint" : "amber"} />
              </div>
            </article>
          ))}
          {timeline.length === 0 ? <EmptyPanel title={pageText("No publishing events", "لا توجد أحداث نشر")} description={pageText("Schedule content items to populate the launch timeline.", "جدوِل عناصر المحتوى لتظهر في الخط الزمني للنشر.")} /> : null}
        </div>
      </Panel>
    </PageMotion>
  );
}
