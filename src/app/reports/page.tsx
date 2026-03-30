"use client";

import { BarChart3, BriefcaseBusiness, CheckCircle2, Sparkles, Target } from "lucide-react";
import { useAppStore } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  BarListChart,
  DonutChart,
  MiniAreaChart,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function ReportsPage() {
  const { clients, tasks, members, activities } = useAppStore();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const published = contentItems.filter((item) => item.status === "published").length;
  const scheduled = contentItems.filter((item) => item.status === "scheduled" || item.status === "publishing_ready").length;
  const approvalRate = approvals.length ? approvals.filter((approval) => approval.status === "approved").length : 0;
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const trendValues = Array.from({ length: 8 }, (_, index) => {
    const edge = new Date();
    edge.setDate(edge.getDate() - (7 - index) * 7);
    return contentItems.filter((item) => new Date(item.createdAt) >= edge).length;
  });

  const clientContribution = clients.map((client) => ({
    label: client.name,
    value: contentItems.filter((item) => item.clientId === client.id).length,
    meta: isArabic ? "حجم التسليم" : "delivery volume",
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  const teamActivity = members.map((member) => ({
    label: member.name,
    value: tasks.filter((task) => task.assigneeId === member.id).length,
    meta: member.role,
  })).sort((a, b) => b.value - a.value).slice(0, 6);

  const platformBreakdown = ["Instagram", "LinkedIn", "TikTok", "Facebook", "YouTube", "X"].map((platform) => ({
    label: platform,
    value: contentItems.filter((item) => item.platform === platform).length,
    meta: isArabic ? "محتوى حي" : "live content",
  }));

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Analytics suite", "حزمة التحليلات")}
        title={pageText("Executive analytics redesign", "إعادة تصميم التحليلات التنفيذية")}
        description={pageText(
          "Rich data visualization for delivery output, team load, approvals, and client distribution.",
          "تصورات بيانات غنية لمخرجات التسليم وعبء الفريق والموافقات وتوزيع العملاء."
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Published", "المنشور")} value={published} hint={pageText("Delivered content in production", "محتوى تم تسليمه في الإنتاج")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Scheduled", "المجدول")} value={scheduled} hint={pageText("Upcoming launch inventory", "مخزون الإطلاق القادم")} icon={Sparkles} tone="violet" />
        <StatCard label={pageText("Team members", "أعضاء الفريق")} value={members.length} hint={pageText("Operators across all functions", "المشغلون عبر كل الوظائف")} icon={Target} tone="blue" />
        <StatCard label={pageText("Clients", "العملاء")} value={clients.length} hint={pageText("Accounts contributing to pipeline", "الحسابات التي تغذي خط العمل")} icon={BriefcaseBusiness} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title={pageText("Momentum curve", "منحنى الزخم")} description={pageText("A simple trend line for recently created content activity.", "خط اتجاه مبسط لنشاط إنشاء المحتوى مؤخرًا.")}
          action={<span className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{isArabic ? `${activities.length} نشاط` : `${activities.length} activities`}</span>}>
          <MiniAreaChart values={trendValues} tone="blue" />
        </Panel>
        <Panel title={pageText("Approval efficiency", "كفاءة الموافقات")} description={pageText("Approved approvals against the total workflow volume.", "الموافقات المعتمدة مقابل إجمالي حجم سير العمل.")}>
          <DonutChart value={approvalRate} total={approvals.length || 1} tone="mint" label={isArabic ? "اعتماد" : "Approval"} />
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <Panel title={pageText("Client contribution", "مساهمة العملاء")} description={pageText("Who is driving the largest content load right now.", "من يقود أكبر حجم محتوى الآن.")} className="xl:col-span-1">
          <BarListChart items={clientContribution} tone="violet" />
        </Panel>
        <Panel title={pageText("Team throughput", "إنتاجية الفريق")} description={pageText("Assignments distributed across active operators.", "توزيع المهام عبر المشغلين النشطين.")} className="xl:col-span-1">
          <BarListChart items={teamActivity} tone="blue" />
        </Panel>
        <Panel title={pageText("Platform footprint", "بصمة المنصات")} description={pageText("Channel-level content distribution.", "توزيع المحتوى على مستوى القنوات.")} className="xl:col-span-1">
          <BarListChart items={platformBreakdown} tone="amber" />
        </Panel>
      </section>

      <Panel title={pageText("Operations scorecard", "بطاقة الأداء التشغيلية")} description={pageText("Core outcome ratios across tasks, content, and approvals.", "نسب النتائج الأساسية عبر المهام والمحتوى والموافقات.")}>
        <div className="grid gap-4 md:grid-cols-3">
          <ScoreCard label={isArabic ? "اكتمال المهام" : "Task completion"} value={`${completedTasks}/${tasks.length || 0}`} icon={Target} />
          <ScoreCard label={isArabic ? "موافقة المحتوى" : "Approval progress"} value={`${approvalRate}/${approvals.length || 0}`} icon={CheckCircle2} />
          <ScoreCard label={isArabic ? "إجمالي المحتوى" : "Total content"} value={contentItems.length} icon={BarChart3} />
        </div>
      </Panel>
    </PageMotion>
  );
}

function ScoreCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-[var(--glass-overlay)] p-5">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.16),rgba(169,139,255,0.16))] text-[var(--accent)]">
        <Icon size={20} />
      </div>
      <div className="mt-4 text-xs uppercase tracking-[0.22em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">{value}</div>
    </div>
  );
}
