"use client";

import Link from "next/link";
import { useState } from "react";
import { BriefcaseBusiness, CheckCircle2, Plus, Sparkles, Target, Eye, Edit, Archive, Trash2 } from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useLanguage } from "@/lib/LanguageContext";
import { AddClientModal } from "@/components/ui/AddClientModal";
import { EditClientModal } from "@/components/ui/EditClientModal";
import type { Client } from "@/lib/types";
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
  const { clients, deleteClient } = useClients();
  const { tasks } = useTasks();
  const { contentItems } = useContentItems();
  const { approvals } = useApprovals();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [showAddClient, setShowAddClient] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteClient(id);
      // Success path: close modal first, then show feedback
      setConfirmDelete(null);
      showToast(isArabic ? "تم حذف العميل بنجاح" : "Client deleted successfully", "success");
    } catch (err) {
      // Failure path: keep modal open so the user can retry or cancel
      const msg = err instanceof Error ? err.message : String(err);
      showToast(
        isArabic
          ? `فشل حذف العميل: ${msg}`
          : `Failed to delete client: ${msg}`,
        "error"
      );
    } finally {
      // Always reset loading so the confirm button becomes usable again
      setDeleting(false);
    }
  };

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
      <AddClientModal open={showAddClient} onClose={() => setShowAddClient(false)} />
      <EditClientModal client={editClient} onClose={() => setEditClient(null)} />
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف العميل" : "Delete client"}
        message={isArabic ? "هل أنت متأكد من حذف هذا العميل؟ سيتم إزالة جميع البيانات المرتبطة به." : "Are you sure you want to delete this client? All associated data will be unlinked."}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <PageHeader
        eyebrow={pageText("Client management", "إدارة العملاء")}
        title={pageText("Clients", "العملاء")}
        description={pageText(
          "Manage client accounts, track delivery health and open tasks.",
          "إدارة حسابات العملاء ومتابعة صحة التسليم والمهام المفتوحة."
        )}
        actions={
          <button
            type="button"
            onClick={() => setShowAddClient(true)}
            className="touch-target inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 active:scale-95"
          >
            <Plus size={16} />
            {isArabic ? "إضافة عميل" : "Add client"}
          </button>
        }
      />

      {/* Stat cards — 2×2 on mobile */}
      <section className="stat-grid">
        <StatCard label={pageText("Total clients", "إجمالي العملاء")} value={clients.length} hint={pageText("All records in your workspace", "كل السجلات في مساحة العمل")} icon={BriefcaseBusiness} tone="blue" />
        <StatCard label={pageText("Active", "النشطون")} value={activeClients} hint={pageText("Accounts in live service", "حسابات في خدمة مباشرة")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Prospects", "العملاء المحتملون")} value={prospects} hint={pageText("Pipeline opportunities", "فرص في خط المبيعات")} icon={Target} tone="amber" />
        <StatCard label={pageText("Content volume", "حجم المحتوى")} value={contentItems.length} hint={pageText("Content tied to clients", "المحتوى المرتبط بالعملاء")} icon={Sparkles} tone="violet" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title={pageText("Client portfolio", "محفظة العملاء")} description={pageText("All client accounts with health indicators.", "جميع حسابات العملاء مع مؤشرات الصحة.")}
          action={<InfoBadge label={isArabic ? `${clients.length} سجل` : `${clients.length} records`} tone="blue" />}>
          {clients.length === 0 ? (
            <EmptyPanel title={pageText("No clients yet", "لا يوجد عملاء بعد")} description={pageText("Add your first client to get started.", "أضف أول عميل للبدء.")} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {clientLoad.map((entry) => (
                <div key={entry.client.id} className="relative glass-panel rounded-[24px] border border-[var(--border)] p-5 transition duration-200 hover:-translate-y-1 active:scale-[0.99]">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/clients/${entry.client.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white" style={{ background: entry.client.color }}>
                        {entry.client.initials}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-[var(--text)]">{entry.client.name}</h3>
                        <p className="truncate text-sm text-[var(--muted)]">{entry.client.company}</p>
                      </div>
                    </Link>
                    <ActionMenu
                      items={[
                        { label: isArabic ? "عرض التفاصيل" : "View details", icon: Eye, onClick: () => {} },
                        { label: isArabic ? "تعديل" : "Edit", icon: Edit, onClick: () => setEditClient(entry.client) },
                        { label: isArabic ? "أرشفة" : "Archive", icon: Archive, onClick: () => {} },
                        { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(entry.client.id) },
                      ]}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <InfoBadge label={entry.client.status} tone={entry.client.status === "active" ? "mint" : entry.client.status === "prospect" ? "amber" : "slate"} />
                    <InfoBadge label={`${entry.contentCount} ${isArabic ? "محتوى" : "content"}`} tone="blue" />
                    <InfoBadge label={`${entry.pendingApprovals} ${isArabic ? "موافقات" : "approvals"}`} tone="violet" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <SummaryCell label={isArabic ? "المحتوى" : "Content"} value={entry.contentCount} />
                    <SummaryCell label={isArabic ? "المهام" : "Tasks"} value={entry.openTasks} />
                    <SummaryCell label={isArabic ? "الزخم" : "Pulse"} value={entry.score} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={pageText("Health leaderboard", "لوحة صحة الحسابات")} description={pageText("A simple ranking based on content volume, open tasks, and approvals pressure.", "ترتيب مبسط يعتمد على حجم المحتوى والمهام المفتوحة وضغط الموافقات.")}
          action={<InfoBadge label={isArabic ? "تحليلات مباشرة" : "Live analytics"} tone="violet" />}>
          {healthiest.length === 0 ? <EmptyPanel title={pageText("No ranking yet", "لا يوجد ترتيب بعد")} description={pageText("Client ranking will appear once accounts have content and tasks.", "سيظهر ترتيب العملاء بمجرد إضافة محتوى ومهام.")} /> : <BarListChart items={healthiest} tone="violet" />}
        </Panel>
      </section>
    </PageMotion>
  );
}

function SummaryCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--glass-overlay)] px-3 py-3 text-center">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}
