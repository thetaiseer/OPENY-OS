"use client";

import { AlertTriangle, CalendarRange, Clock, Rocket, Zap } from "lucide-react";
import { usePublishing } from "@/lib/PublishingContext";
import { useContentItems } from "@/lib/ContentContext";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
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

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel
          title={pageText("Due now", "مستحق الآن")}
          description={pageText("Content at or past its scheduled release window.", "محتوى وصل أو تجاوز نافذة الإطلاق.")}
          action={<InfoBadge label={isArabic ? `${dueNow.length} عنصر` : `${dueNow.length} items`} tone="amber" />}
        >
          <div className="space-y-3">
            {dueNow.map((item) => (
              <ContentRow
                key={item.id}
                title={item.title}
                client={clients.find((c) => c.id === item.clientId)?.name ?? (isArabic ? "غير معروف" : "Unknown")}
                platform={item.platform}
                date={item.scheduledDate}
                time={item.scheduledTime}
                status={item.status}
                readiness={getReadinessForItem(item)}
                isArabic={isArabic}
                urgentBorder
              />
            ))}
            {dueNow.length === 0 && (
              <EmptyPanel
                title={pageText("All clear", "لا يوجد مستحق")}
                description={pageText("No content is currently past its release window.", "لا يوجد محتوى تجاوز نافذة الإطلاق حاليًا.")}
              />
            )}
          </div>
        </Panel>

        <Panel
          title={pageText("This week", "هذا الأسبوع")}
          description={pageText("Upcoming launches scheduled for the next 7 days.", "الإطلاقات المجدولة في الـ 7 أيام القادمة.")}
          action={<InfoBadge label={isArabic ? `${thisWeek.length} عنصر` : `${thisWeek.length} items`} tone="violet" />}
        >
          <div className="space-y-3">
            {thisWeek.slice(0, 8).map((item) => (
              <ContentRow
                key={item.id}
                title={item.title}
                client={clients.find((c) => c.id === item.clientId)?.name ?? (isArabic ? "غير معروف" : "Unknown")}
                platform={item.platform}
                date={item.scheduledDate}
                time={item.scheduledTime}
                status={item.status}
                readiness={getReadinessForItem(item)}
                isArabic={isArabic}
              />
            ))}
            {thisWeek.length === 0 && (
              <EmptyPanel
                title={pageText("No launches this week", "لا إطلاقات هذا الأسبوع")}
                description={pageText("Schedule content items to populate this panel.", "جدوِل عناصر المحتوى لتظهر هنا.")}
              />
            )}
          </div>
        </Panel>
      </section>

      <Panel
        title={pageText("Readiness breakdown", "تحليلات الجاهزية")}
        description={pageText("Content readiness derived from completeness and approval state.", "جاهزية المحتوى مستمدة من الاكتمال وحالة الموافقة.")}
        action={<InfoBadge label={isArabic ? `${contentItems.length} عنصر` : `${contentItems.length} items`} tone="violet" />}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <BarListChart items={readiness} tone="violet" />
          <div className="grid grid-cols-2 gap-3">
            {readiness.map((r) => (
              <div
                key={r.label}
                className="flex flex-col gap-1 rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] p-4"
              >
                <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--accent-2)" }}>{r.value}</span>
                <span className="text-xs font-medium text-[var(--text)]">{r.label}</span>
                <span className="text-[11px] text-[var(--muted)]">{r.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </PageMotion>
  );
}

function ContentRow({
  title,
  client,
  platform,
  date,
  time,
  status,
  readiness,
  isArabic,
  urgentBorder = false,
}: {
  title: string;
  client: string;
  platform: string;
  date: string;
  time?: string;
  status: string;
  readiness: string;
  isArabic: boolean;
  urgentBorder?: boolean;
}) {
  const statusTone = status === "published" ? "mint" : status === "failed" ? "rose" : "amber";
  const readinessTone = readiness === "ready_to_publish" ? "mint" : readiness === "not_ready" ? "rose" : "amber";

  return (
    <article
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 transition-colors"
      style={{
        borderColor: urgentBorder ? "rgba(245,158,11,0.35)" : "var(--border)",
        background: urgentBorder ? "rgba(245,158,11,0.04)" : "var(--glass-overlay)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: urgentBorder ? "rgba(245,158,11,0.12)" : "var(--accent-soft)", color: urgentBorder ? "var(--amber)" : "var(--accent)" }}
        >
          <Clock size={15} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--text)]">{title}</h3>
          <p className="text-xs text-[var(--muted)]">{client}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <InfoBadge label={`${date}${time ? ` · ${time}` : ""}`} tone="blue" />
        <InfoBadge label={platform} tone="slate" />
        <InfoBadge label={status} tone={statusTone} />
        <InfoBadge label={readiness.replace(/_/g, " ")} tone={readinessTone} />
      </div>
    </article>
  );
}
