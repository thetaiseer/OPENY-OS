"use client";

import { useState } from "react";
import { FolderOpen, Image as ImageIcon, PlayCircle, Sparkles, Trash2, Archive, Eye } from "lucide-react";
import { useAssets } from "@/lib/AssetsContext";
import { useClients } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { useToast } from "@/lib/ToastContext";
import { parseFirestoreError } from "@/lib/utils/crud";
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

export default function AssetsPage() {
  const { assets, deleteAsset } = useAssets();
  const { clients } = useClients();
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteAsset(id);
      showToast(isArabic ? "تم حذف الأصل بنجاح" : "Asset deleted successfully", "success");
    } catch (err) {
      showToast(`${isArabic ? "فشل حذف الأصل" : "Failed to delete asset"}: ${parseFirestoreError(err, isArabic)}`, "error");
    } finally {
      setConfirmDelete(null);
      setDeleting(false);
    }
  };

  const images = assets.filter((asset) => asset.type === "image" || asset.type === "logo").length;
  const videos = assets.filter((asset) => asset.type === "video").length;
  const documents = assets.filter((asset) => asset.type === "document" || asset.type === "brand_file").length;

  const folders = Array.from(new Set(assets.map((asset) => asset.folder || (isArabic ? "غير مصنف" : "Unsorted")))).map((folder) => ({
    label: folder,
    value: assets.filter((asset) => (asset.folder || (isArabic ? "غير مصنف" : "Unsorted")) === folder).length,
    meta: isArabic ? "أصول" : "assets",
  }));

  return (
    <PageMotion>
      <ConfirmDialog
        open={confirmDelete !== null}
        title={isArabic ? "حذف الأصل" : "Delete asset"}
        message={isArabic ? "هل أنت متأكد من حذف هذا الأصل؟" : "Are you sure you want to delete this asset?"}
        confirmLabel={isArabic ? "حذف" : "Delete"}
        cancelLabel={isArabic ? "إلغاء" : "Cancel"}
        tone="danger"
        loading={deleting}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
      <PageHeader
        eyebrow={pageText("Media library", "مكتبة الوسائط")}
        title={pageText("Assets", "الأصول")}
        description={pageText(
          "Manage images, videos, documents, and brand resources.",
          "إدارة الصور والفيديو والوثائق وموارد الهوية."
        )}
      />

      <section className="stat-grid">
        <StatCard label={pageText("Total assets", "إجمالي الأصول")} value={assets.length} hint={pageText("All media synced to the workspace", "كل الوسائط المتزامنة مع مساحة العمل")} icon={FolderOpen} tone="blue" />
        <StatCard label={pageText("Images", "الصور")} value={images} hint={pageText("Graphics, photos, and logos", "الرسومات والصور والشعارات")} icon={ImageIcon} tone="mint" />
        <StatCard label={pageText("Videos", "الفيديو")} value={videos} hint={pageText("Video and motion assets", "أصول الفيديو والحركة")} icon={PlayCircle} tone="violet" />
        <StatCard label={pageText("Documents", "الوثائق")} value={documents} hint={pageText("Documents and brand files", "الوثائق وملفات الهوية")} icon={Sparkles} tone="amber" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title={pageText("Asset gallery", "معرض الأصول")} description={pageText("All workspace media and brand assets.", "جميع وسائط مساحة العمل وأصول الهوية.")}
          action={<InfoBadge label={isArabic ? `${clients.length} عميل` : `${clients.length} clients`} tone="blue" />}>
          {assets.length === 0 ? (
            <EmptyPanel title={pageText("No assets found", "لا توجد أصول")} description={pageText("Uploaded workspace assets will appear here automatically.", "الأصول المرفوعة في مساحة العمل ستظهر هنا تلقائيًا.")} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.slice(0, 9).map((asset) => (
                <article key={asset.id} className="glass-panel rounded-[24px] border border-[var(--border)] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(106,168,255,0.16),rgba(61,217,180,0.16))] text-[var(--accent)]">
                      {asset.type === "video" ? <PlayCircle size={18} /> : <ImageIcon size={18} />}
                    </div>
                    <ActionMenu
                      items={[
                        { label: isArabic ? "عرض التفاصيل" : "View details", icon: Eye, onClick: () => {} },
                        { label: isArabic ? "أرشفة" : "Archive", icon: Archive, onClick: () => {} },
                        { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(asset.id) },
                      ]}
                    />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[var(--text)]">{asset.name}</h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">{clients.find((client) => client.id === asset.clientId)?.name || (isArabic ? "عميل غير معروف" : "Unknown client")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoBadge label={asset.type} tone="violet" />
                    <InfoBadge label={asset.folder || (isArabic ? "غير مصنف" : "Unsorted")} tone="slate" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={pageText("Folder distribution", "توزيع المجلدات")} description={pageText("Visual breakdown of how assets are grouped.", "تفصيل بصري لكيفية تجميع الأصول.")}>
          {folders.length === 0 ? <EmptyPanel title={pageText("No folders yet", "لا توجد مجلدات بعد")} description={pageText("Folders and grouped assets will appear here once available.", "المجلدات والأصول المجمعة ستظهر هنا عند توفرها.")} /> : <BarListChart items={folders} tone="violet" />}
        </Panel>
      </section>
    </PageMotion>
  );
}
