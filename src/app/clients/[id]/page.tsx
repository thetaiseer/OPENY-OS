"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, Image as ImageIcon, Mail, Phone, Sparkles, StickyNote, Workflow } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useAssets } from "@/lib/AssetsContext";
import { useClientNotes } from "@/lib/ClientNotesContext";
import { useBank } from "@/lib/BankContext";
import { useLanguage } from "@/lib/LanguageContext";
import {
  ButtonLink,
  DetailRow,
  DonutChart,
  EmptyPanel,
  InfoBadge,
  MetricList,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function ClientWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { clients } = useClients();
  const { tasks } = useTasks();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { filtered: assets } = useAssets(params.id);
  const { filtered: notes } = useClientNotes(params.id);
  const { filtered: bankEntries } = useBank(params.id);
  const { language } = useLanguage();
  const isArabic = language === "ar";

  const client = clients.find((entry) => entry.id === params.id);

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("This workspace could not find a matching client record in Firebase.", "تعذر العثور على سجل عميل مطابق داخل Firebase.")} />
      </PageMotion>
    );
  }

  const clientTasks = tasks.filter((task) => task.clientId === client.id);
  const clientContent = contentItems.filter((item) => item.clientId === client.id);
  const clientApprovals = approvals.filter((approval) => approval.clientId === client.id);
  const published = clientContent.filter((item) => item.status === "published").length;
  const quota = 30;

  return (
    <PageMotion>
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/clients" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-[var(--text)]">
          <ArrowLeft size={16} />
          {isArabic ? "العودة للعملاء" : "Back to clients"}
        </Link>
        <ButtonLink href="/content" label={pageText("Open planning", "افتح التخطيط")} tone="violet" />
      </div>

      <PageHeader
        eyebrow={pageText("Client workspace", "مساحة العميل")}
        title={{ en: client.name, ar: client.name }}
        description={pageText(
          "A redesigned account view for delivery health, assets, notes, and operational signals.",
          "عرض حساب مُعاد تصميمه لصحة التسليم، الأصول، الملاحظات، والإشارات التشغيلية."
        )}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Content", "المحتوى")} value={clientContent.length} hint={pageText("All items linked to this account", "كل العناصر المرتبطة بهذا الحساب")} icon={Sparkles} tone="blue" />
        <StatCard label={pageText("Open tasks", "المهام المفتوحة")} value={clientTasks.filter((task) => task.status !== "done").length} hint={pageText("Execution load for the team", "عبء التنفيذ على الفريق")} icon={Workflow} tone="amber" />
        <StatCard label={pageText("Approvals", "الموافقات")} value={clientApprovals.length} hint={pageText("Workflow checkpoints", "نقاط التحقق في سير العمل")} icon={BarChart3} tone="violet" />
        <StatCard label={pageText("Assets", "الأصول")} value={assets.length} hint={pageText("Media and brand files", "الوسائط وملفات الهوية")} icon={ImageIcon} tone="mint" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-6">
          <Panel title={pageText("Account profile", "ملف الحساب")} description={pageText("Core client identity and contact details.", "هوية العميل الأساسية وتفاصيل التواصل.")}>
            <div className="mb-5 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] text-lg font-semibold text-white" style={{ background: client.color }}>
                {client.initials}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">{client.name}</h2>
                <p className="text-sm text-[var(--muted)]">{client.company}</p>
              </div>
            </div>
            <div className="space-y-3">
              <DetailRow label={isArabic ? "الحالة" : "Status"} value={<InfoBadge label={client.status} tone={client.status === "active" ? "mint" : client.status === "prospect" ? "amber" : "slate"} />} />
              <DetailRow label={isArabic ? "البريد الإلكتروني" : "Email"} value={<span className="inline-flex items-center gap-2"><Mail size={14} />{client.email}</span>} />
              <DetailRow label={isArabic ? "الهاتف" : "Phone"} value={<span className="inline-flex items-center gap-2"><Phone size={14} />{client.phone || (isArabic ? "غير مضاف" : "Not added")}</span>} />
              <DetailRow label={isArabic ? "تاريخ الإنشاء" : "Created"} value={new Date(client.createdAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")} />
            </div>
          </Panel>

          <Panel title={pageText("Delivery quota", "حصة التسليم")} description={pageText("Published content against a default monthly plan.", "المحتوى المنشور مقابل خطة شهرية افتراضية.")}
            action={<InfoBadge label={isArabic ? `${published}/${quota} منشور` : `${published}/${quota} published`} tone="mint" />}>
            <DonutChart value={published} total={quota} tone="mint" label={isArabic ? "الحصة" : "Quota"} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title={pageText("Operational snapshot", "لقطة تشغيلية")} description={pageText("A concise overview for content, notes, assets, and copy banks.", "نظرة مختصرة على المحتوى، الملاحظات، الأصول، وبنوك النصوص.")}>
            <MetricList
              items={[
                { label: isArabic ? "المحتوى المجدول" : "Scheduled content", value: clientContent.filter((item) => item.scheduledDate).length },
                { label: isArabic ? "المحتوى المنشور" : "Published content", value: published },
                { label: isArabic ? "الملاحظات" : "Notes", value: notes.length },
                { label: isArabic ? "بنك النصوص" : "Bank entries", value: bankEntries.length },
              ]}
            />
          </Panel>

          <Panel title={pageText("Content and tasks", "المحتوى والمهام")} description={pageText("Recent delivery items attached to this client.", "أحدث عناصر التسليم المرتبطة بهذا العميل.")}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {clientContent.slice(0, 4).map((item) => (
                  <article key={item.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{item.title}</h3>
                      <InfoBadge label={item.status} tone={item.status === "published" ? "mint" : item.status === "failed" ? "rose" : "violet"} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">{item.platform} · {item.contentType}</p>
                  </article>
                ))}
                {clientContent.length === 0 ? <EmptyPanel title={pageText("No content linked", "لا يوجد محتوى مرتبط")} description={pageText("Content items assigned to this client will appear here.", "عناصر المحتوى المخصصة لهذا العميل ستظهر هنا.")} /> : null}
              </div>
              <div className="space-y-3">
                {clientTasks.slice(0, 4).map((task) => (
                  <article key={task.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-[var(--text)]">{task.title}</h3>
                      <InfoBadge label={task.priority} tone={task.priority === "high" ? "rose" : task.priority === "medium" ? "amber" : "mint"} />
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">{task.assigneeName || task.assignee || (isArabic ? "غير معيّن" : "Unassigned")}</p>
                  </article>
                ))}
                {clientTasks.length === 0 ? <EmptyPanel title={pageText("No tasks linked", "لا توجد مهام مرتبطة")} description={pageText("Client-specific tasks will show here in real time.", "المهام الخاصة بالعميل ستظهر هنا مباشرة.")} /> : null}
              </div>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title={pageText("Notes stream", "سجل الملاحظات")} description={pageText("Internal and client-facing notes in a clean card feed.", "ملاحظات داخلية وموجهة للعميل ضمن تدفق بطاقات نظيف.")}>
          <div className="space-y-3">
            {notes.slice(0, 5).map((note) => (
              <article key={note.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text)]"><StickyNote size={15} />{note.author}</div>
                  <InfoBadge label={note.type} tone={note.type === "internal" ? "amber" : "mint"} />
                </div>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{note.content}</p>
              </article>
            ))}
            {notes.length === 0 ? <EmptyPanel title={pageText("No notes available", "لا توجد ملاحظات متاحة")} description={pageText("Notes added through the workspace are displayed here immediately.", "الملاحظات المضافة عبر مساحة العمل تظهر هنا مباشرة.")} /> : null}
          </div>
        </Panel>

        <Panel title={pageText("Asset gallery", "معرض الأصول")} description={pageText("A refreshed view for uploaded media and brand material.", "عرض متجدد للوسائط المرفوعة ومواد الهوية.")}>
          <div className="grid gap-3 sm:grid-cols-2">
            {assets.slice(0, 6).map((asset) => (
              <article key={asset.id} className="rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.18),rgba(61,217,180,0.18))] text-[var(--accent)]">
                  <ImageIcon size={18} />
                </div>
                <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">{asset.name}</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{asset.type}</p>
              </article>
            ))}
            {assets.length === 0 ? <EmptyPanel title={pageText("No assets uploaded", "لم يتم رفع أصول بعد")} description={pageText("Images, videos, and brand resources will appear once synced to Firebase.", "الصور والفيديو وموارد الهوية ستظهر بعد مزامنتها مع Firebase.")} /> : null}
          </div>
        </Panel>
      </section>
    </PageMotion>
  );
}
