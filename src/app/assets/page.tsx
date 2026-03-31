"use client";

import { useState } from "react";
import { FileText, FolderOpen, Image as ImageIcon, PlayCircle, Search, Sparkles, Trash2, Archive, Eye } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredAssets = assets.filter((asset) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      asset.name.toLowerCase().includes(q) ||
      asset.type.toLowerCase().includes(q) ||
      (asset.folder ?? "").toLowerCase().includes(q) ||
      (clients.find((c) => c.id === asset.clientId)?.name ?? "").toLowerCase().includes(q)
    );
  });

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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={pageText("Total assets", "إجمالي الأصول")} value={assets.length} hint={pageText("All media synced to the workspace", "كل الوسائط المتزامنة مع مساحة العمل")} icon={FolderOpen} tone="blue" />
        <StatCard label={pageText("Images", "الصور")} value={images} hint={pageText("Graphics, photos, and logos", "الرسومات والصور والشعارات")} icon={ImageIcon} tone="mint" />
        <StatCard label={pageText("Videos", "الفيديو")} value={videos} hint={pageText("Video and motion assets", "أصول الفيديو والحركة")} icon={PlayCircle} tone="violet" />
        <StatCard label={pageText("Documents", "الوثائق")} value={documents} hint={pageText("Documents and brand files", "الوثائق وملفات الهوية")} icon={Sparkles} tone="amber" />
      </section>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute start-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isArabic ? "ابحث في الأصول بالاسم أو النوع أو المجلد…" : "Search assets by name, type, or folder…"}
          className="glass-input w-full rounded-2xl py-3 pe-4 ps-10 text-sm"
        />
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title={pageText("Asset gallery", "معرض الأصول")}
          description={pageText("All workspace media and brand assets.", "جميع وسائط مساحة العمل وأصول الهوية.")}
          action={<InfoBadge label={isArabic ? `${filteredAssets.length} نتيجة` : `${filteredAssets.length} results`} tone="blue" />}
        >
          {filteredAssets.length === 0 ? (
            <EmptyPanel
              title={searchQuery ? pageText("No results found", "لا توجد نتائج") : pageText("No assets found", "لا توجد أصول")}
              description={searchQuery ? pageText("Try a different search term.", "جرّب مصطلح بحث مختلف.") : pageText("Uploaded workspace assets will appear here automatically.", "الأصول المرفوعة في مساحة العمل ستظهر هنا تلقائيًا.")}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAssets.slice(0, 9).map((asset) => {
                const clientName = clients.find((c) => c.id === asset.clientId)?.name ?? (isArabic ? "عميل غير معروف" : "Unknown client");
                const sizeLabel = asset.fileSize ? `${(asset.fileSize / 1024).toFixed(0)} KB` : null;
                const createdLabel = asset.createdAt ? new Date(asset.createdAt).toLocaleDateString(isArabic ? "ar-EG" : "en-US") : null;
                return (
                  <article key={asset.id} className="glass-panel flex flex-col rounded-2xl border border-[var(--border)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        {asset.type === "video" ? <PlayCircle size={18} /> : asset.type === "document" || asset.type === "brand_file" ? <FileText size={18} /> : <ImageIcon size={18} />}
                      </div>
                      <ActionMenu
                        items={[
                          { label: isArabic ? "عرض التفاصيل" : "View details", icon: Eye, onClick: () => {} },
                          { label: isArabic ? "أرشفة" : "Archive", icon: Archive, onClick: () => {} },
                          { label: isArabic ? "حذف" : "Delete", icon: Trash2, tone: "danger", onClick: () => setConfirmDelete(asset.id) },
                        ]}
                      />
                    </div>
                    <h3 className="mt-3 truncate text-sm font-semibold text-[var(--text)]">{asset.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{clientName}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <InfoBadge label={asset.type} tone="violet" />
                      <InfoBadge label={asset.folder || (isArabic ? "غير مصنف" : "Unsorted")} tone="slate" />
                      {sizeLabel && <InfoBadge label={sizeLabel} tone="amber" />}
                      {createdLabel && <InfoBadge label={createdLabel} tone="slate" />}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title={pageText("Folder distribution", "توزيع المجلدات")}
          description={pageText("Visual breakdown of how assets are grouped.", "تفصيل بصري لكيفية تجميع الأصول.")}
        >
          {folders.length === 0 ? (
            <EmptyPanel title={pageText("No folders yet", "لا توجد مجلدات بعد")} description={pageText("Folders and grouped assets will appear here once available.", "المجلدات والأصول المجمعة ستظهر هنا عند توفرها.")} />
          ) : (
            <BarListChart items={folders} tone="violet" />
          )}
        </Panel>
      </section>
    </PageMotion>
  );
}
