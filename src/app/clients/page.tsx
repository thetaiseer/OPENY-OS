"use client";

import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Sparkles, Target } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
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

export default function ClientsPage() {
  const { clients } = useClients();
  const { tasks } = useTasks();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const activeClients = clients.filter((client) => client.status === "active").length;
  const prospects = clients.filter((client) => client.status === "prospect").length;
  const clientLoad = clients.map((client) => {
    const contentCount = contentItems.filter((item) => item.clientId === client.id).length;
    const openTasks = tasks.filter((task) => task.clientId === client.id && task.status !== "done").length;
    const pendingApprovals = approvals.filter((approval) => approval.clientId === client.id && approval.status !== "approved").length;
    return {
      client,
      contentCount,
      openTasks,
      pendingApprovals,
      score: contentCount * 3 + openTasks * 2 + pendingApprovals * 4,
    };
  });

  const healthiest = [...clientLoad]
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => ({
      label: entry.client.name,
      value: entry.score,
      meta: isArabic ? `${entry.contentCount} محتوى · ${entry.openTasks} مهام` : `${entry.contentCount} content · ${entry.openTasks} tasks`,
    }));

  return (
    <PageMotion>
      <PageHeader
        eyebrow={pageText("Client intelligence", "ذكاء العملاء")}
        title={pageText("Premium client spaces", "مساحات عملاء فاخرة")}
        description={pageText(
          "A new CRM surface for account health, delivery pressure, and cross-functional visibility.",
          "واجهة CRM جديدة لصحة الحسابات وضغط التسليم والرؤية المشتركة بين الفرق."
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Total clients", "إجمالي العملاء")} value={clients.length} hint={pageText("All records in your workspace", "كل السجلات في مساحة العمل")} icon={BriefcaseBusiness} tone="blue" />
        <StatCard label={pageText("Active", "النشطون")} value={activeClients} hint={pageText("Accounts in live service", "حسابات في خدمة مباشرة")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Prospects", "العملاء المحتملون")} value={prospects} hint={pageText("Pipeline opportunities", "فرص في خط المبيعات")} icon={Target} tone="amber" />
        <StatCard label={pageText("Content volume", "حجم المحتوى")} value={contentItems.length} hint={pageText("Content tied to clients", "المحتوى المرتبط بالعملاء")} icon={Sparkles} tone="violet" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title={pageText("Client portfolio", "محفظة العملاء")} description={pageText("Every account in a fresh card-based surface with health indicators and fast drill-down.", "كل حساب ضمن واجهة بطاقات جديدة مع مؤشرات صحة والوصول السريع للتفاصيل.")}
          action={<InfoBadge label={isArabic ? `${clients.length} سجل` : `${clients.length} records`} tone="blue" />}>
          {clients.length === 0 ? (
            <EmptyPanel title={pageText("No clients synced yet", "لم تتم مزامنة عملاء بعد")} description={pageText("As client records arrive from Firebase, this portfolio will populate in real time.", "عند وصول سجلات العملاء من Firebase ستُملأ هذه المحفظة مباشرة.")} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {clientLoad.map((entry) => (
                <Link key={entry.client.id} href={`/clients/${entry.client.id}`} className="glass-panel rounded-[24px] border border-white/10 p-5 transition duration-200 hover:-translate-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-semibold text-white" style={{ background: entry.client.color }}>
                        {entry.client.initials}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[var(--text)]">{entry.client.name}</h3>
                        <p className="text-sm text-[var(--muted)]">{entry.client.company}</p>
                      </div>
                    </div>
                    <ArrowUpRight size={18} className="text-[var(--accent)]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoBadge label={entry.client.status} tone={entry.client.status === "active" ? "mint" : entry.client.status === "prospect" ? "amber" : "slate"} />
                    <InfoBadge label={`${entry.contentCount} ${isArabic ? "محتوى" : "content"}`} tone="blue" />
                    <InfoBadge label={`${entry.pendingApprovals} ${isArabic ? "موافقات" : "approvals"}`} tone="violet" />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                    <SummaryCell label={isArabic ? "المحتوى" : "Content"} value={entry.contentCount} />
                    <SummaryCell label={isArabic ? "المهام" : "Tasks"} value={entry.openTasks} />
                    <SummaryCell label={isArabic ? "الزخم" : "Pulse"} value={entry.score} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={pageText("Health leaderboard", "لوحة صحة الحسابات")} description={pageText("A simple ranking based on content volume, open tasks, and approvals pressure.", "ترتيب مبسط يعتمد على حجم المحتوى والمهام المفتوحة وضغط الموافقات.")}
          action={<InfoBadge label={isArabic ? "تحليلات مباشرة" : "Live analytics"} tone="violet" />}>
          {healthiest.length === 0 ? <EmptyPanel title={pageText("No ranking yet", "لا يوجد ترتيب بعد")} description={pageText("Client signals will appear here once accounts start receiving content and tasks.", "ستظهر الإشارات هنا بمجرد بدء ربط العملاء بالمحتوى والمهام.")} /> : <BarListChart items={healthiest} tone="violet" />}
        </Panel>
      </section>
    </PageMotion>
  );
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}
