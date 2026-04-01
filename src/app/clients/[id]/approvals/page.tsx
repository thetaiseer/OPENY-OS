"use client";

import { useParams } from "next/navigation";
import { CheckCircle, RefreshCw, XCircle } from "lucide-react";
import { useClients } from "@/lib/AppContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { EmptyPanel, InfoBadge, PageMotion, Panel, pageText } from "@/components/redesign/ui";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending_internal: { bg: "rgba(59,130,246,0.12)", color: "#3b82f6" },
  pending_client:   { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
  approved:         { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
  rejected:         { bg: "rgba(239,68,68,0.12)",  color: "#ef4444" },
  revision_requested: { bg: "rgba(139,92,246,0.12)", color: "#8b5cf6" },
};

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  pending_internal: { en: "Pending internal",  ar: "انتظار داخلي"    },
  pending_client:   { en: "Pending client",    ar: "انتظار العميل"   },
  approved:         { en: "Approved",          ar: "موافق"           },
  rejected:         { en: "Rejected",          ar: "مرفوض"           },
  revision_requested: { en: "Revision requested", ar: "طلب مراجعة"  },
};

export default function ClientApprovalsPage() {
  const params = useParams();
  const { clients } = useClients();
  const { approvals, updateApprovalStatus } = useApprovals();
  const { contentItems } = useContentItems();
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === "ar";

  const client         = clients.find((c) => c.id === params.id);
  const clientApprovals = approvals.filter((a) => a.clientId === params.id);
  const pending        = clientApprovals.filter((a) => a.status === "pending_internal" || a.status === "pending_client").length;

  const handleAction = async (id: string, status: string) => {
    try {
      await updateApprovalStatus(id, status);
      showToast(isArabic ? "تم تحديث الحالة" : "Status updated", "success");
    } catch {
      showToast(isArabic ? "فشل التحديث" : "Update failed", "error");
    }
  };

  if (!client) {
    return (
      <PageMotion>
        <EmptyPanel title={pageText("Client not found", "العميل غير موجود")} description={pageText("", "")} />
      </PageMotion>
    );
  }

  return (
    <PageMotion>
      <Panel
        title={pageText("Approvals", "الموافقات")}
        description={pageText(
          "Review and approve content items for this client.",
          "مراجعة واعتماد عناصر المحتوى لهذا العميل."
        )}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <InfoBadge
              label={isArabic ? `${pending} في الانتظار` : `${pending} pending`}
              tone="amber"
            />
            <InfoBadge
              label={isArabic ? `${clientApprovals.length} إجمالي` : `${clientApprovals.length} total`}
              tone="blue"
            />
          </div>
        }
      >
        {clientApprovals.length === 0 ? (
          <EmptyPanel
            title={pageText("No approvals yet", "لا توجد موافقات بعد")}
            description={pageText(
              "Approval requests linked to this client will appear here.",
              "طلبات الموافقة المرتبطة بهذا العميل ستظهر هنا."
            )}
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {clientApprovals.map((approval) => {
              const contentItem = contentItems.find((i) => i.id === approval.contentItemId);
              const sc = STATUS_STYLES[approval.status] ?? STATUS_STYLES.pending_internal;
              const sl = STATUS_LABELS[approval.status] ?? STATUS_LABELS.pending_internal;
              const isPending = approval.status === "pending_internal" || approval.status === "pending_client";
              return (
                <article
                  key={approval.id}
                  style={{
                    borderRadius: 14, border: "1px solid var(--border)",
                    background: "var(--panel)", padding: "16px",
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                        {contentItem?.title ?? (isArabic ? "محتوى محذوف" : "Deleted content")}
                      </p>
                      {contentItem?.platform && (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                          {contentItem.platform}
                        </p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "4px 10px",
                      background: sc.bg, color: sc.color, flexShrink: 0,
                    }}>
                      {isArabic ? sl.ar : sl.en}
                    </span>
                  </div>

                  {(approval.internalComments?.length > 0 || approval.clientComments?.length > 0) && (
                    <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                      {approval.internalComments?.length > 0 && (
                        <span style={{ marginInlineEnd: 12 }}>
                          {isArabic ? `${approval.internalComments.length} تعليق داخلي` : `${approval.internalComments.length} internal comment(s)`}
                        </span>
                      )}
                      {approval.clientComments?.length > 0 && (
                        <span>
                          {isArabic ? `${approval.clientComments.length} تعليق عميل` : `${approval.clientComments.length} client comment(s)`}
                        </span>
                      )}
                    </div>
                  )}

                  {isPending && (
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => handleAction(approval.id, "approved")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                          background: "rgba(16,185,129,0.12)", color: "#10b981",
                          border: "1px solid rgba(16,185,129,0.3)", cursor: "pointer",
                        }}
                      >
                        <CheckCircle size={13} />
                        {isArabic ? "اعتماد" : "Approve"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(approval.id, "revision_requested")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                          background: "rgba(139,92,246,0.12)", color: "#8b5cf6",
                          border: "1px solid rgba(139,92,246,0.3)", cursor: "pointer",
                        }}
                      >
                        <RefreshCw size={13} />
                        {isArabic ? "طلب مراجعة" : "Request revision"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(approval.id, "rejected")}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          borderRadius: 10, padding: "6px 14px", fontSize: 12, fontWeight: 600,
                          background: "rgba(239,68,68,0.12)", color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer",
                        }}
                      >
                        <XCircle size={13} />
                        {isArabic ? "رفض" : "Reject"}
                      </button>
                    </div>
                  )}

                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                    {new Date(approval.createdAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </PageMotion>
  );
}
