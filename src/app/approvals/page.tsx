"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Eye, MessageSquareText, ShieldCheck, Trash2 } from "lucide-react";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import {
  EmptyPanel,
  InfoBadge,
  PageHeader,
  PageMotion,
  Panel,
  StatCard,
  pageText,
} from "@/components/redesign/ui";

type StatusTab = "all" | "pending_internal" | "pending_client" | "approved" | "revisions";

const STATUS_TABS: { value: StatusTab; label: string; labelAr: string }[] = [
  { value: "all", label: "All", labelAr: "الكل" },
  { value: "pending_internal", label: "Internal Review", labelAr: "مراجعة داخلية" },
  { value: "pending_client", label: "Client Review", labelAr: "مراجعة العميل" },
  { value: "approved", label: "Approved", labelAr: "معتمد" },
  { value: "revisions", label: "Revisions", labelAr: "تعديلات" },
];

export default function ApprovalsPage() {
  const { approvals, deleteApproval } = useApprovals();
  const { contentItems } = useContentItems();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusTab, setStatusTab] = useState<StatusTab>("all");

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteApproval(id);
      showToast(isArabic ? "تم حذف طلب الموافقة بنجاح" : "Approval deleted successfully", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف طلب الموافقة" : "Failed to delete approval"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const pendingInternal = approvals.filter((a) => a.status === "pending_internal").length;
  const pendingClient = approvals.filter((a) => a.status === "pending_client").length;
  const approved = approvals.filter((a) => a.status === "approved").length;
  const revisions = approvals.filter((a) => a.status === "revision_requested" || a.status === "rejected").length;

  const filteredApprovals = approvals.filter((approval) => {
    if (statusTab === "all") return true;
    if (statusTab === "revisions") return approval.status === "revision_requested" || approval.status === "rejected";
    return approval.status === statusTab;
  });

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
        title={pageText("Approvals", "الموافقات")}
        description={pageText(
          "Manage internal reviews, client approvals, and revision requests.",
          "إدارة المراجعات الداخلية وموافقات العميل وطلبات التعديل."
        )}
      />

      <section className="stat-grid">
        <StatCard label={pageText("Pending internal", "الداخلي المعلق")} value={pendingInternal} hint={pageText("Waiting for team feedback", "بانتظار ملاحظات الفريق")} icon={ShieldCheck} tone="amber" />
        <StatCard label={pageText("Pending client", "معلق لدى العميل")} value={pendingClient} hint={pageText("Awaiting customer decision", "بانتظار قرار العميل")} icon={Clock3} tone="violet" />
        <StatCard label={pageText("Approved", "المعتمد")} value={approved} hint={pageText("Ready for downstream publishing", "جاهز لمتابعة النشر")} icon={CheckCircle2} tone="mint" />
        <StatCard label={pageText("Revisions", "التعديلات")} value={revisions} hint={pageText("Items that need new work", "عناصر تحتاج إلى عمل جديد")} icon={MessageSquareText} tone="rose" />
      </section>

      <Panel
        title={pageText("Approval requests", "طلبات الموافقة")}
        description={pageText("Track content through internal and client review stages.", "تتبع المحتوى عبر مراحل المراجعة الداخلية والعميل.")}
        action={<InfoBadge label={isArabic ? `${filteredApprovals.length} طلب` : `${filteredApprovals.length} requests`} tone="blue" />}
      >
        {/* Status Tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusTab(tab.value)}
              className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150"
              style={{
                background: statusTab === tab.value ? "var(--accent)" : "var(--glass-overlay)",
                color: statusTab === tab.value ? "white" : "var(--muted)",
                border: `1px solid ${statusTab === tab.value ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              {isArabic ? tab.labelAr : tab.label}
            </button>
          ))}
        </div>

        {filteredApprovals.length === 0 ? (
          <EmptyPanel
            title={pageText("No approvals found", "لا توجد موافقات")}
            description={pageText(
              "Once content is submitted for review, approvals will populate here automatically.",
              "عند إرسال المحتوى للمراجعة ستظهر الموافقات هنا تلقائيًا."
            )}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredApprovals.map((approval) => {
              const item = contentItems.find((content) => content.id === approval.contentItemId);
              const client = clients.find((entry) => entry.id === approval.clientId);
              const commentsCount = approval.internalComments.length + approval.clientComments.length;
              const statusTone =
                approval.status === "approved"
                  ? "mint"
                  : approval.status === "pending_client"
                  ? "violet"
                  : approval.status === "pending_internal"
                  ? "amber"
                  : "rose";

              return (
                <div key={approval.id} className="card card-hover p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text)" }}>
                        {item?.title || approval.contentItemId}
                      </h3>
                      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                        {client?.name || (isArabic ? "عميل غير معروف" : "Unknown client")}
                      </p>
                    </div>
                    <ActionMenu
                      items={[
                        { label: isArabic ? "عرض التفاصيل" : "View details", icon: Eye, onClick: () => {} },
                        { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(approval.id) },
                      ]}
                      size={16}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <InfoBadge label={approval.status.replace(/_/g, " ")} tone={statusTone} />
                    <InfoBadge label={`${commentsCount} ${isArabic ? "تعليقات" : "comments"}`} tone="slate" />
                    <InfoBadge
                      label={new Date(approval.updatedAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                      tone="blue"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}
