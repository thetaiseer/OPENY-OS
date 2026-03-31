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
  Workflow } from
"lucide-react";
import { useAppStore, useActivities } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { usePublishing } from "@/lib/PublishingContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";

import {
  BarListChart,
  EmptyPanel,
  InfoBadge,
  KanbanBoard,
  MiniAreaChart,
  PageMotion,
  Panel,
  StatCard,
  pageText } from
"@/components/redesign/ui";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

const BOARD_COLUMNS = [
{ id: "strategy", title: { en: "Strategy", ar: "الاستراتيجية" }, statuses: ["idea", "draft", "copywriting"] },
{ id: "production", title: { en: "Production", ar: "الإنتاج" }, statuses: ["design", "in_progress", "internal_review"] },
{ id: "review", title: { en: "Review", ar: "المراجعة" }, statuses: ["client_review", "approved"] },
{ id: "delivery", title: { en: "Delivery", ar: "التسليم" }, statuses: ["scheduled", "publishing_ready", "published"] }];


export default function DashboardPage() {
  const { clients, tasks, members } = useAppStore();
  const { activities, clearActivities } = useActivities();
  const { contentItems } = useContentItems();
  const { getDueNowItems, getThisWeekItems } = usePublishing();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const scheduledThisWeek = getThisWeekItems(contentItems).length;
  const dueNow = getDueNowItems(contentItems).length;
  const publishedContent = contentItems.filter((item) => item.status === "published").length;

  const weeklySeries = Array.from({ length: 8 }, (_, index) => {
    const edge = new Date();
    edge.setDate(edge.getDate() - (7 - index) * 7);
    return contentItems.filter((item) => new Date(item.createdAt) >= edge).length;
  });

  const platformStats = ["Instagram", "LinkedIn", "TikTok", "Facebook", "YouTube", "X"].map((platform) => ({
    label: platform,
    value: contentItems.filter((item) => item.platform === platform).length,
    meta: isArabic ? "منشورات مرتبطة" : "connected items"
  }));

  const boardColumns = BOARD_COLUMNS.map((column) => ({
    id: column.id,
    title: isArabic ? column.title.ar : column.title.en,
    items: contentItems.filter((item) => column.statuses.includes(item.status)).slice(0, 4)
  }));

  const now = new Date();
  const hour = now.getHours();
  const greeting = isArabic ?
  hour < 12 ? "صباح الخير" : hour < 17 ? "مساء الخير" : "مساء النور" :
  hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = now.toLocaleDateString(isArabic ? "ar-EG" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  return (
    <PageMotion>
      {/* Modals */}
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
        onCancel={() => setConfirmClear(false)} />
      

      {/* Hero Section */}
      <div
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 mb-6"
        style={{ background: "linear-gradient(135deg, #4F6EF7 0%, #7C5CF6 100%)" }}>
        
        <div className="relative z-10">
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: 500 }}>
            {greeting} · {dateLabel}
          </p>
          <h1 style={{ color: "white", fontSize: "24px", fontWeight: 700, marginTop: "4px" }}>
            {isArabic ? "نظرة عامة على مساحة العمل" : "Workspace Overview"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "14px", marginTop: "6px", maxWidth: "480px" }}>
            {isArabic ?
            "إليك ملخص نشاطك اليومي وحالة مشاريعك" :
            "Here's what's happening across your workspace today."}
          </p>
          <div className="flex flex-wrap gap-3 mt-5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.18)", color: "white" }}>
              
              <Clock3 size={14} />
              {isArabic ? `${publishedContent} منشورات` : `${publishedContent} Published`}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold"
              style={{ background: "rgba(255,255,255,0.18)", color: "white" }}>
              
              <CalendarRange size={14} />
              {isArabic ? `${scheduledThisWeek} مجدول هذا الأسبوع` : `${scheduledThisWeek} Scheduled This Week`}
            </span>
          </div>
        </div>
        {/* Decorative circles */}
        <div
          className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 bg-white"
          style={{ transform: "translate(25%, -25%)" }} />
        
        <div
          className="pointer-events-none absolute bottom-0 right-32 w-32 h-32 rounded-full opacity-10 bg-white"
          style={{ transform: "translateY(30%)" }} />
        
      </div>

      {/* Stat Cards Grid */}
      <div className="stat-grid">
        <StatCard
          label={pageText("Clients", "العملاء")}
          value={clients.length}
          hint={pageText("Active relationships", "العلاقات النشطة")}
          icon={BriefcaseBusiness}
          tone="blue" />
        
        <StatCard
          label={pageText("Task completion", "إنجاز المهام")}
          value={`${completedTasks}/${tasks.length || 0}`}
          hint={pageText("Finished vs total", "المكتمل من الإجمالي")}
          icon={Workflow}
          tone="mint" />
        
        <StatCard
          label={pageText("Published", "المنشورات")}
          value={publishedContent}
          hint={pageText("Published content items", "عناصر المحتوى المنشورة")}
          icon={Clock3}
          tone="amber" />
        
        <StatCard
          label={pageText("Content items", "عناصر المحتوى")}
          value={contentItems.length}
          hint={pageText("Across all platforms", "عبر جميع المنصات")}
          icon={TrendingUp}
          tone="violet" />
        
      </div>

      {/* Chart + Platform distribution */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Panel
          title={pageText("Content Pipeline", "خط إنتاج المحتوى")}
          description={pageText("Eight-week creation trend.", "مؤشر ثماني أسابيع للمحتوى المُنشأ.")}
          action={<InfoBadge label={isArabic ? `${dueNow} مستحق الآن` : `${dueNow} due now`} tone={dueNow > 0 ? "amber" : "mint"} />}
          className="lg:col-span-3">
          
          <MiniAreaChart values={weeklySeries} tone="blue" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <QuickMetric label={isArabic ? "الفريق" : "Team"} value={members.length} />
            <QuickMetric label={isArabic ? "المحتوى" : "Content"} value={contentItems.length} />
            <QuickMetric label={isArabic ? "الأنشطة" : "Activity"} value={activities.length} />
          </div>
        </Panel>

        <Panel
          title={pageText("By Platform", "حسب المنصة")}
          description={pageText("Content across platforms.", "المحتوى عبر المنصات.")}
          action={<InfoBadge label={isArabic ? "بيانات حية" : "Live data"} tone="violet" />}
          className="lg:col-span-2">
          
          <BarListChart items={platformStats} tone="violet" />
        </Panel>
      </div>

      {/* Content Board */}
      <Panel title={pageText("Content Board", "لوحة المحتوى")} noPadding>
        <div className="p-5 sm:p-6">
          {contentItems.length === 0 ?
          <EmptyPanel
            title={pageText("No content yet", "لا يوجد محتوى بعد")}
            description={pageText("Add content items to see them here across all pipeline stages.", "أضف عناصر محتوى لتظهر هنا عبر جميع مراحل خط الإنتاج.")} /> :


          <KanbanBoard
            columns={boardColumns}
            renderItem={(item) =>
            <article className="border border-[var(--border)] bg-[var(--panel)] p-4" style={{ borderRadius: "var(--radius-card)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{item.platform} · {item.contentType}</p>
                    </div>
                    <InfoBadge
                  label={item.priority}
                  tone={item.priority === "high" ? "rose" : item.priority === "medium" ? "amber" : "mint"} />
                
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm text-[var(--muted)]">
                    {item.caption || (isArabic ? "لا يوجد وصف بعد" : "No caption yet")}
                  </p>
                </article>
            } />

          }
        </div>
      </Panel>

      {/* Recent Activity */}
      <Panel
        title={pageText("Recent Activity", "آخر الأنشطة")}
        description={pageText("Latest updates from your workspace.", "آخر التحديثات من مساحة عملك.")}
        action={
        activities.length > 0 ?
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--rose)] hover:border-[var(--rose)]">
          
              <Trash2 size={13} />
              {isArabic ? "مسح السجل" : "Clear history"}
            </button> :
        undefined
        }>
        
        <div className="space-y-3">
          {activities.slice(0, 5).map((activity) =>
          <div key={activity.id} className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <Sparkles size={13} style={{ color: "var(--accent)" }} />
                {new Date(activity.timestamp).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
              </div>
              <p className="mt-2 text-sm font-medium text-[var(--text)]">{activity.message}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{activity.detail}</p>
            </div>
          )}
          {activities.length === 0 &&
          <EmptyPanel
            title={pageText("No activity yet", "لا توجد أنشطة بعد")}
            description={pageText("Activity events from clients, tasks, and publishing will stream here automatically.", "ستظهر هنا تلقائيًا أحداث العملاء والمهام والنشر.")} />

          }
        </div>
      </Panel>

      {/* Quick Actions */}
      <Panel
        title={pageText("Quick actions", "إجراءات سريعة")}
        description={pageText("Jump directly into key workspace sections.", "انتقل مباشرة إلى أقسام مساحة العمل الرئيسية.")}>
        
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Shortcut href="/content" title={isArabic ? "المحتوى" : "Content"} description={isArabic ? "كانبان وتقويم وتحليلات النشر" : "Kanban, calendar, and publishing analytics"} icon={Sparkles} />
          <Shortcut href="/publishing" title={isArabic ? "النشر" : "Publishing"} description={isArabic ? "إدارة الجدولة والنشر" : "Manage scheduling and publishing"} icon={CheckCircle2} />
          <Shortcut href="/clients" title={isArabic ? "العملاء" : "Clients"} description={isArabic ? "إدارة حسابات العملاء والمهام" : "Manage client accounts and workload"} icon={TrendingUp} />
        </div>
      </Panel>
    </PageMotion>);

}

function QuickMetric({ label, value }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--glass-overlay)] px-4 py-3" style={{ borderRadius: "var(--radius-btn)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-[var(--text)]">{value}</div>
    </div>);

}

function Shortcut({
  href,
  title,
  description,
  icon: Icon





}) {
  return (
    <Link
      href={href}
      className="group border border-[var(--border)] bg-[var(--glass-overlay)] p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-md block"
      style={{ borderRadius: "var(--radius-card)" }}>
      
      <div
        className="inline-flex h-11 w-11 items-center justify-center"
        style={{ background: "linear-gradient(135deg, var(--accent-soft) 0%, var(--accent-2-soft) 100%)", color: "var(--accent)", borderRadius: "var(--radius-btn)" }}>
        
        <Icon size={20} />
      </div>
      <h3 className="mt-4 text-base font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{description}</p>
    </Link>);

}