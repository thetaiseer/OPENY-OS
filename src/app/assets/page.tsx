"use client";

import { useMemo, useState } from "react";
import {
  ImageIcon,
  Plus,
  Search,
  LayoutGrid,
  List,
  Folder,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { useAssets } from "@/lib/AssetContext";
import { useAppStore } from "@/lib/AppContext";
import { AssetsGrid } from "@/components/assets/AssetsGrid";
import { AssetsList } from "@/components/assets/AssetsList";
import { AssetUploadModal } from "@/components/assets/AssetUploadModal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";

const ASSET_TYPES: { value: string; label: string }[] = [
  { value: "", label: "allTypes" },
  { value: "image", label: "typeImage" },
  { value: "video", label: "typeVideo" },
  { value: "logo", label: "typeLogo" },
  { value: "brand_file", label: "typeBrandFile" },
  { value: "document", label: "typeDocument" },
  { value: "template", label: "typeTemplate" },
  { value: "caption_template", label: "typeCaptionTemplate" },
  { value: "hashtag_bank", label: "typeHashtagBank" },
  { value: "cta_bank", label: "typeCtaBank" },
];

export default function AssetsPage() {
  const { t } = useLanguage();
  const { assets, loading, createAsset, deleteAsset } = useAssets();
  const { clients } = useAppStore();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [folderFilter, setFolderFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);

  // Unique folders
  const folders = useMemo(() => {
    const s = new Set<string>();
    assets.forEach((a) => { if (a.folder) s.add(a.folder); });
    return Array.from(s).sort();
  }, [assets]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return assets.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q) && !a.tags.join(" ").toLowerCase().includes(q)) return false;
      if (typeFilter && a.type !== typeFilter) return false;
      if (clientFilter && a.clientId !== clientFilter) return false;
      if (folderFilter && a.folder !== folderFilter) return false;
      return true;
    });
  }, [assets, search, typeFilter, clientFilter, folderFilter]);

  const selectStyle = {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t("assets.title")}
        subtitle={`${filtered.length} ${t("assets.title").toLowerCase()}`}
        icon={ImageIcon}
        action={
          <Button icon={Plus} onClick={() => setUploadOpen(true)}>
            {t("assets.newAsset")}
          </Button>
        }
      />

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("assets.searchPlaceholder")}
            className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none"
            style={selectStyle}
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={selectStyle}
        >
          {ASSET_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>
              {t(`assets.${label}`)}
            </option>
          ))}
        </select>

        {/* Client filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={selectStyle}
        >
          <option value="">{t("assets.allClients")}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Folder filter */}
        {folders.length > 0 && (
          <select
            value={folderFilter}
            onChange={(e) => setFolderFilter(e.target.value)}
            className="rounded-xl px-3 py-2 text-sm outline-none"
            style={selectStyle}
          >
            <option value="">{t("assets.allFolders")}</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        )}

        {/* View switcher */}
        <div className="flex gap-1 p-1 rounded-xl ms-auto" style={{ background: "var(--surface-3)" }}>
          {(["grid", "list"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="p-1.5 rounded-lg transition-all"
              style={{
                background: view === v ? "var(--surface-1)" : "transparent",
                color: view === v ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {v === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
            </button>
          ))}
        </div>
      </div>

      {/* Folder grouping when no folder filter */}
      {!folderFilter && folders.length > 0 && view === "grid" ? (
        <div className="space-y-6">
          {/* All ungrouped first, then by folder */}
          {(() => {
            const ungrouped = filtered.filter((a) => !a.folder);
            const grouped = folders
              .map((f) => ({ folder: f, items: filtered.filter((a) => a.folder === f) }))
              .filter((g) => g.items.length > 0);
            return (
              <>
                {ungrouped.length > 0 && <AssetsGrid assets={ungrouped} onDelete={deleteAsset} />}
                {grouped.map(({ folder, items }) => (
                  <div key={folder}>
                    <div className="flex items-center gap-2 mb-3">
                      <Folder size={14} style={{ color: "var(--text-muted)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {folder}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        ({items.length})
                      </span>
                    </div>
                    <AssetsGrid assets={items} onDelete={deleteAsset} />
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      ) : view === "grid" ? (
        <AssetsGrid assets={filtered} onDelete={deleteAsset} />
      ) : (
        <AssetsList assets={filtered} onDelete={deleteAsset} clients={clients} />
      )}

      <AssetUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSave={createAsset}
        clients={clients}
      />
    </div>
  );
}
