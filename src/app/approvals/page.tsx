"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, ShieldCheck, Trash2, Eye } from "lucide-react";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import {
  EmptyPanel,
  InfoBadge,
  KanbanBoard,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

export default function ApprovalsPage() {
  const { approvals, deleteApproval } = useApprovals();
  const { contentItems } = useContentItems();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteApproval(id);
      showToast(isArabic ? "تم حذف طلب الموافقة بنجاح" : "Approval deleted successfully", "success");
    } catch {
      showToast(isArabic ? "فشل حذف طلب الموافقة" : "Failed to delete approval", "error");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const pendingInternal = approvals.filter((approval) => approval.status === "pending_internal").length;
  const pendingClient = approvals.filter((approval) => approval.status === "pending_client").length;
  const approved = approvals.filter((approval) => approval.status === "approved").length;
  const revisions = approvals.filter((approval) => approval.status === "revision_requested" || approval.status === "rejected").length;

  const columns = [
    { id: "internal", title: isArabic ? "مراجعة داخلية" : "Internal review", items: approvals.filter((approval) => approval.status === "pending_internal") },
    { id: "client", title: isArabic ? "مراجعة العميل" : "Client review", items: approvals.filter((approval) => approval.status === "pending_client") },
    { id: "approved", title: isArabic ? "معتمد" : "Approved", items: approvals.filter((approval) => approval.status === "approved") },
    { id: "changes", title: isArabic ? "تعديلات مطلوبة" : "Changes requested", items: approvals.filter((approval) => approval.status === "revision_requested" || approval.status === "rejected") },
  ];

  return (
    <PageMotion>
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف طلب الموافقة" : "Delete approval"}
        message={isArabic ? "هل أنت متأكد من حذف طلب الموافقة هذا؟" : "Are you sure you want to delete this approval request?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <PageHeader
        eyebrow={pageText("Review pipeline", "خط المراجعة")}
        title={pageText("Approval flow redesigned", "إعادة تصميم تدفق الموافقات")}
        description={pageText(
          "A premium review command center for internal checks, client approvals, and revision loops.",
          "مركز تحكم فاخر للمراجعات الداخلية وموافقات العميل ودورات التعديل."
        )}
      />

      <section className="stat-grid">
        <StatCard label={pageText("Pending internal", "الداخلي المعلق")} value={pendingInternal} hint={pageText("Waiting for team feedback", "بانتظار ملاحظات الفريق")} icon={ShieldCheck} tone="amber" />
        <StatCard label={pageText("Pending client", "معلق لدى العميل")} value={pendingClient} hint={pageText("Awaiting customer decision", "بانتظار قرار العميل")} icon={Clock3} tone="violet" />
        <StatCard label={pageText("Approved", "المعتمد")} value={approved} hint={pageText("Ready for downstream publishing", "جاهز لمتابعة النشر")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Revisions", "التعديلات")} value={revisions} hint={pageText("Items that need new work", "عناصر تحتاج إلى عمل جديد")} icon={MessageSquareText} tone="rose" />
      </section>

      <Panel title={pageText("Approval board", "لوحة الموافقات")} description={pageText("A zero-based kanban for the full approval lifecycle.", "لوحة كانبان جديدة بالكامل لدورة الموافقة كاملة.")}
        action={<InfoBadge label={isArabic ? `${approvals.length} طلب` : `${approvals.length} requests`} tone="blue" />}>
        {approvals.length === 0 ? (
          <EmptyPanel title={pageText("No approvals found", "لا توجد موافقات")} description={pageText("Once content is submitted for review, approvals will populate here automatically.", "عند إرسال المحتوى للمراجعة ستظهر الموافقات هنا تلقائيًا.")} />
        ) : (
          <KanbanBoard
            columns={columns}
            renderItem={(approval) => {
              const item = contentItems.find((content) => content.id === approval.contentItemId);
              const client = clients.find((entry) => entry.id === approval.clientId);
              const commentsCount = approval.internalComments.length + approval.clientComments.length;
              return (
                <article className="rounded-[22px] border border-[var(--border)] bg-[var(--glass-overlay)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">{item?.title || approval.contentItemId}</h3>
                      <p className="mt-1 text-xs text-[var(--muted)]">{client?.name || (isArabic ? "عميل غير معروف" : "Unknown client")}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <InfoBadge label={approval.status.replace(/_/g, " ")} tone={approval.status === "approved" ? "mint" : approval.status === "pending_client" ? "violet" : approval.status === "pending_internal" ? "amber" : "rose"} />
                      <ActionMenu
                        items={[
                          { label: isArabic ? "عرض التفاصيل" : "View details", icon: Eye, onClick: () => {} },
                          { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(approval.id) },
                        ]}
                        size={16}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoBadge label={`${commentsCount} ${isArabic ? "تعليقات" : "comments"}`} tone="slate" />
                    <InfoBadge label={new Date(approval.updatedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")} tone="blue" />
                  </div>
                </article>
              );
            }}
          />
        )}
      </Panel>
    </PageMotion>
  );
}
