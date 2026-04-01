"use client";

import { useParams } from "next/navigation";
import { BarChart3, Image as ImageIcon, Sparkles, Workflow } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useAssets } from "@/lib/AssetsContext";
import { useClientNotes } from "@/lib/ClientNotesContext";
import { useBank } from "@/lib/BankContext";
import { useLanguage } from "@/lib/LanguageContext";

import {
  DonutChart,
  EmptyPanel,
  InfoBadge,
  MetricList,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function ClientOverviewPage() {
  const params = useParams();
  const { clients } = useClients();
  const { tasks } = useTasks();
  const { contentItems } = useContentItems();
  const { filtered: assets } = useAssets(params.id);
  const { filtered: notes } = useClientNotes(params.id);
  const { filtered: bankEntries } = useBank(params.id);
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const client = clients.find((c) => c.id === params.id);

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel
          title={pageText("Client not found", "العميل غير موجود")}
          description={pageText("No client record matches this ID.", "لا يوجد سجل عميل يطابق هذا المعرّف.")}
        />
      </PageMotion>
    );
  }

  const clientTasks   = tasks.filter((t) => t.clientId === client.id);
  const clientContent = contentItems.filter((i) => i.clientId === client.id);
  const published     = clientContent.filter((i) => i.status === "published").length;
  const quota         = 30;

  return (
    <PageMotion>
      {/* Quick-stat row */}
      <section className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard
          label={pageText("Content items", "عناصر المحتوى")}
          value={clientContent.length}
          hint={pageText("All items linked to this account", "كل العناصر المرتبطة بهذا الحساب")}
          icon={Sparkles}
          tone="blue"
        />
        <StatCard
          label={pageText("Open tasks", "المهام المفتوحة")}
          value={clientTasks.filter((t) => t.status !== "done").length}
          hint={pageText("Execution load for the team", "عبء التنفيذ على الفريق")}
          icon={Workflow}
          tone="amber"
        />
        <StatCard
          label={pageText("Published", "المنشورات")}
          value={published}
          hint={pageText("Content published for this client", "المحتوى المنشور لهذا العميل")}
          icon={BarChart3}
          tone="violet"
        />
        <StatCard
          label={pageText("Assets", "الأصول")}
          value={assets.length}
          hint={pageText("Media and brand files", "الوسائط وملفات الهوية")}
          icon={ImageIcon}
          tone="mint"
        />
      </section>

      {/* Detailed panels */}
      <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Panel
          title={pageText("Delivery quota", "حصة التسليم")}
          description={pageText(
            "Published content against a default monthly plan.",
            "المحتوى المنشور مقابل خطة شهرية افتراضية."
          )}
          action={
            <InfoBadge
              label={isArabic ? `${published}/${quota} منشور` : `${published}/${quota} published`}
              tone="mint"
            />
          }
        >
          <DonutChart value={published} total={quota} tone="mint" label={isArabic ? "الحصة" : "Quota"} />
        </Panel>

        <Panel
          title={pageText("Operational snapshot", "لقطة تشغيلية")}
          description={pageText(
            "A concise overview of content, notes, assets, and copy banks.",
            "نظرة مختصرة على المحتوى، الملاحظات، الأصول، وبنوك النصوص."
          )}
        >
          <MetricList
            items={[
              { label: isArabic ? "المحتوى المجدول"  : "Scheduled content",  value: clientContent.filter((i) => i.scheduledDate).length },
              { label: isArabic ? "المحتوى المنشور"  : "Published content",  value: published },
              { label: isArabic ? "المهام المفتوحة"  : "Open tasks",         value: clientTasks.filter((t) => t.status !== "done").length },
              { label: isArabic ? "الملاحظات"        : "Notes",              value: notes.length },
              { label: isArabic ? "بنك النصوص"       : "Bank entries",       value: bankEntries.length },
              { label: isArabic ? "الأصول"           : "Assets",             value: assets.length },
            ]}
          />
        </Panel>
      </section>
    </PageMotion>
  );
}
