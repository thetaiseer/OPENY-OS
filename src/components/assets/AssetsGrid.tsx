"use client";

import {
  Image as ImgIcon,
  Video,
  FileText,
  Star,
  Trash2,
  MoreHorizontal,
  Tag,
  Folder,
  Hash,
  Zap,
  Layout,
  Type,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { Asset, AssetType } from "@/lib/types";
import { useState } from "react";

function typeIcon(type: AssetType) {
  const map: Record<AssetType, typeof ImgIcon> = {
    image: ImgIcon,
    video: Video,
    logo: Star,
    brand_file: Star,
    document: FileText,
    template: Layout,
    caption_template: Type,
    hashtag_bank: Hash,
    cta_bank: Zap,
  };
  return map[type] ?? FileText;
}

function typeColor(type: AssetType): string {
  const map: Record<AssetType, string> = {
    image: "#4f8ef7",
    video: "#a78bfa",
    logo: "#fbbf24",
    brand_file: "#fbbf24",
    document: "#8888a0",
    template: "#34d399",
    caption_template: "#34d399",
    hashtag_bank: "#f87171",
    cta_bank: "#f97316",
  };
  return map[type] ?? "#8888a0";
}

interface AssetsGridProps {
  assets: Asset[];
  onDelete?: (id: string) => void;
}

export function AssetsGrid({ assets, onDelete }: AssetsGridProps) {
  const { t } = useLanguage();

  if (assets.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 rounded-2xl"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <ImgIcon size={36} style={{ color: "var(--text-muted)" }} />
        <p className="mt-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          {t("assets.noAssetsTitle")}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {t("assets.noAssetsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} onDelete={onDelete} />
      ))}
    </div>
  );
}

function AssetCard({ asset, onDelete }: { asset: Asset; onDelete?: (id: string) => void }) {
  const { t } = useLanguage();
  const [menu, setMenu] = useState(false);
  const Icon = typeIcon(asset.type);
  const color = typeColor(asset.type);

  return (
    <div
      className="rounded-2xl overflow-hidden group relative"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Preview area */}
      <div
        className="w-full flex items-center justify-center"
        style={{ background: "var(--surface-3)", aspectRatio: "1", position: "relative" }}
      >
        {(asset.type === "image" || asset.type === "logo") && asset.fileUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.fileUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: `${color}22` }}
          >
            <Icon size={22} color={color} />
          </div>
        )}

        {/* Actions overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", color: "white" }}
            >
              <MoreHorizontal size={13} />
            </button>
            {menu && (
              <div
                className="absolute top-8 right-0 rounded-xl overflow-hidden z-20 min-w-[120px]"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
              >
                {onDelete && (
                  <button
                    onClick={() => { onDelete(asset.id); setMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-all"
                    style={{ color: "var(--error)" }}
                  >
                    <Trash2 size={12} />
                    {t("common.delete")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
          {asset.name}
        </p>
        <div className="flex items-center gap-1 mt-1">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full"
            style={{ background: `${color}22`, color }}
          >
            {asset.type.replace(/_/g, " ")}
          </span>
          {asset.folder && (
            <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <Folder size={9} />
              {asset.folder}
            </span>
          )}
        </div>
        {asset.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            {asset.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
              >
                <Tag size={8} />
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
