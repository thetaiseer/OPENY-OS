"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FolderOpen, Trash2, Upload } from "lucide-react";
import { useClients } from "@/lib/AppContext";
import { useAssets } from "@/lib/AssetsContext";
import { useLanguage } from "@/lib/LanguageContext";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyPanel, InfoBadge, PageMotion, Panel, pageText } from "@/components/redesign/ui";

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  image:    { bg: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  video:    { bg: "rgba(139,92,246,0.12)",  color: "#8b5cf6" },
  document: { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  brand:    { bg: "rgba(16,185,129,0.12)",  color: "#10b981" },
  other:    { bg: "rgba(100,116,139,0.12)", color: "#64748b" },
};

export default function ClientAssetsPage() {
  const params = useParams();
  const { clients } = useClients();
  const { filtered: assets, deleteAsset } = useAssets(params.id);
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isArabic = language === "ar";

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const client = clients.find((c) => c.id === params.id);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteAsset(id);
      showToast(isArabic ? "تم حذف الملف" : "Asset deleted", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف الملف" : "Failed to delete asset"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
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
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف الملف" : "Delete asset"}
        message={isArabic ? "هل أنت متأكد من حذف هذا الملف؟" : "Are you sure you want to delete this asset?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

      <Panel
        title={pageText("Client assets", "ملفات العميل")}
        description={pageText(
          "All media, brand files, and documents linked to this client.",
          "جميع الوسائط وملفات الهوية والمستندات المرتبطة بهذا العميل."
        )}
        action={
          <InfoBadge
            label={isArabic ? `${assets.length} ملف` : `${assets.length} files`}
            tone="mint"
          />
        }
      >
        {assets.length === 0 ? (
          <EmptyPanel
            title={pageText("No assets yet", "لا توجد ملفات بعد")}
            description={pageText(
              "Assets uploaded and linked to this client will appear here automatically.",
              "الملفات التي يتم رفعها وربطها بهذا العميل ستظهر هنا تلقائياً."
            )}
          />
        ) : (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
            {assets.map((asset) => {
              const tc = TYPE_COLORS[asset.type] ?? TYPE_COLORS.other;
              return (
                <article
                  key={asset.id}
                  style={{
                    borderRadius: 14, border: "1px solid var(--border)",
                    background: "var(--panel)", padding: "14px 16px",
                    boxShadow: "var(--shadow-xs)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600, color: "var(--text)",
                        margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {asset.name}
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                        {asset.format ? `${asset.type} · ${asset.format}` : asset.type}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "3px 9px", background: tc.bg, color: tc.color }}>
                        {asset.type}
                      </span>
                      <ActionMenu
                        items={[
                          { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(asset.id) },
                        ]}
                        size={15}
                      />
                    </div>
                  </div>
                  {asset.fileUrl && (
                    <a
                      href={asset.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10,
                        borderRadius: 10, border: "1px solid var(--border)",
                        padding: "5px 12px", fontSize: 12, fontWeight: 500,
                        color: "var(--text)", textDecoration: "none",
                        background: "var(--glass-overlay)",
                      }}
                    >
                      <FolderOpen size={12} />
                      {isArabic ? "فتح الملف" : "Open file"}
                    </a>
                  )}
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                    {new Date(asset.createdAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US")}
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
