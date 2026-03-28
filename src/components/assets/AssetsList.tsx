"use client";

import {
  Image as ImgIcon,
  Video,
  FileText,
  Star,
  Trash2,
  Tag,
  Folder,
  Hash,
  Zap,
  Layout,
  Type,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import type { Asset, AssetType } from "@/lib/types";

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

interface AssetsListProps {
  assets: Asset[];
  onDelete?: (id: string) => void;
  clients?: { id: string; name: string }[];
}

export function AssetsList({ assets, onDelete, clients = [] }: AssetsListProps) {
  const { t } = useLanguage();

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id;

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
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      {assets.map((asset, idx) => {
        const Icon = typeIcon(asset.type);
        const color = typeColor(asset.type);
        return (
          <div
            key={asset.id}
            className="flex items-center gap-3 px-4 py-3 transition-all"
            style={{
              borderTop: idx > 0 ? "1px solid var(--border)" : undefined,
            }}
          >
            {/* Icon */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}22` }}
            >
              <Icon size={16} color={color} />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {asset.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px]" style={{ color }}>
                  {asset.type.replace(/_/g, " ")}
                </span>
                {asset.folder && (
                  <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                    <Folder size={9} />
                    {asset.folder}
                  </span>
                )}
                {asset.clientId && (
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {clientName(asset.clientId)}
                  </span>
                )}
              </div>
            </div>

            {/* Tags */}
            <div className="hidden sm:flex items-center gap-1 flex-wrap">
              {asset.tags.slice(0, 3).map((tag) => (
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

            {/* Format */}
            {asset.format && (
              <span className="text-[10px] hidden md:block" style={{ color: "var(--text-muted)" }}>
                {asset.format.toUpperCase()}
              </span>
            )}

            {/* Actions */}
            {onDelete && (
              <button
                onClick={() => onDelete(asset.id)}
                className="p-1.5 rounded-lg transition-all flex-shrink-0"
                style={{ color: "var(--text-muted)" }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
