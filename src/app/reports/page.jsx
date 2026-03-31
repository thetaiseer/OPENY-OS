"use client";

import { BarChart3, BriefcaseBusiness, CheckCircle2, ListChecks, Sparkles, Target, TrendingUp } from "lucide-react";
import { useAppStore } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  BarListChart,
  DonutChart,
  MiniAreaChart,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText } from
"@/components/redesign/ui";

export default function ReportsPage() {
  const { clients, tasks, members, activities } = useAppStore();
  const { contentItems } = useContentItems();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const published = contentItems.filter((item) => item.status === "published").length;
  const scheduled = contentItems.filter((item) => item.status === "scheduled" || item.status === "publishing_ready").length;
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const trendValues = Array.from({ length: 8 }, (_, index) => {
    const edge = new Date();
    edge.setDate(edge.getDate() - (7 - index) * 7);
    return contentItems.filter((item) => new Date(item.createdAt) >= edge).length;
  });

  const clientContribution = clients.map((client) => ({
    label: client.name,
    value: contentItems.filter((item) => item.clientId === client.id).length,
    meta: isArabic ? "حجم التسليم" : "delivery volume"
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  const teamActivity = members.map((member) => ({
    label: member.name,
    value: tasks.filter((task) => task.assigneeId === member.id).length,
    meta: member.role
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  const platformBreakdown = ["Instagram", "LinkedIn", "TikTok", "Facebook", "YouTube", "X"].map((platform) => ({
    label: platform,
    value: contentItems.filter((item) => item.platform === platform).length,
    meta: isArabic ? "محتوى حي" : "live content"
  }));

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Analytics suite", "حزمة التحليلات")}
        title={pageText("Analytics", "التحليلات")}
        description={pageText(
          "Data overview for delivery output, team workload, and client distribution.",
          "نظرة عامة على بيانات التسليم وعبء الفريق وتوزيع العملاء."
        )} />
      

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Published", "المنشور")} value={published} hint={pageText("Delivered content in production", "محتوى تم تسليمه في الإنتاج")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Scheduled", "المجدول")} value={scheduled} hint={pageText("Upcoming launch inventory", "مخزون الإطلاق القادم")} icon={Sparkles} tone="violet" />
        <StatCard label={pageText("Team members", "أعضاء الفريق")} value={members.length} hint={pageText("Operators across all functions", "المشغلون عبر كل الوظائف")} icon={Target} tone="blue" />
        <StatCard label={pageText("Clients", "العملاء")} value={clients.length} hint={pageText("Accounts contributing to pipeline", "الحسابات التي تغذي خط العمل")} icon={BriefcaseBusiness} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title={pageText("Content momentum", "زخم المحتوى")}
          description={pageText("Weekly content creation trend over the past 8 weeks.", "اتجاه إنشاء المحتوى الأسبوعي خلال الـ 8 أسابيع الماضية.")}
          action={<span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--accent)" }}><TrendingUp size={13} />{isArabic ? `${activities.length} نشاط` : `${activities.length} activities`}</span>}>
          
          <MiniAreaChart values={trendValues} tone="blue" />
        </Panel>
        <Panel
          title={pageText("Publishing progress", "تقدم النشر")}
          description={pageText("Published vs. total content items.", "المحتوى المنشور مقابل الإجمالي.")}>
          
          <DonutChart value={published} total={contentItems.length || 1} tone="mint" label={isArabic ? "منشور" : "Published"} />
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Panel
          title={pageText("Platform distribution", "توزيع المنصات")}
          description={pageText("Content volume per publishing channel.", "حجم المحتوى لكل قناة نشر.")}>
          
          <BarListChart items={platformBreakdown} tone="amber" />
        </Panel>
        <Panel
          title={pageText("Team workload", "عبء الفريق")}
          description={pageText("Task assignments distributed across team members.", "توزيع المهام عبر أعضاء الفريق.")}>
          
          <BarListChart items={teamActivity} tone="blue" />
        </Panel>
        <Panel
          title={pageText("Client output", "إنتاج العملاء")}
          description={pageText("Content volume driven by each client account.", "حجم المحتوى لكل حساب عميل.")}>
          
          <BarListChart items={clientContribution} tone="violet" />
        </Panel>
      </section>

      <Panel
        title={pageText("Operations scorecard", "بطاقة الأداء التشغيلية")}
        description={pageText("Core outcome ratios across tasks and content.", "نسب النتائج الأساسية عبر المهام والمحتوى.")}>
        
        <div className="grid gap-4 md:grid-cols-3">
          <ScoreCard label={isArabic ? "اكتمال المهام" : "Task completion"} value={`${completedTasks}/${tasks.length}`} icon={ListChecks} />
          <ScoreCard label={isArabic ? "المحتوى المنشور" : "Published content"} value={`${published}/${contentItems.length || 0}`} icon={CheckCircle2} />
          <ScoreCard label={isArabic ? "إجمالي المحتوى" : "Total content"} value={contentItems.length} icon={BarChart3} />
        </div>
      </Panel>
    </PageMotion>);

}

function ScoreCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--glass-overlay)] p-5">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.16),rgba(169,139,255,0.16))] text-[var(--accent)]">
        <Icon size={20} />
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</div>
    </div>);

}