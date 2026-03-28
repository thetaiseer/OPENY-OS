"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useLanguage } from "@/lib/LanguageContext";
import type { AssetType } from "@/lib/types";
import type { CreateAssetData } from "@/lib/AssetContext";

const ASSET_TYPES: AssetType[] = [
  "image", "video", "logo", "brand_file", "document",
  "template", "caption_template", "hashtag_bank", "cta_bank",
];

interface AssetUploadModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateAssetData) => void;
  clientId?: string;
  clients: { id: string; name: string }[];
}

export function AssetUploadModal({ open, onClose, onSave, clientId, clients }: AssetUploadModalProps) {
  const { t } = useLanguage();
  const [form, setForm] = useState<{
    name: string;
    fileUrl: string;
    type: AssetType;
    clientId: string;
    folder: string;
    tags: string;
    format: string;
  }>({
    name: "",
    fileUrl: "",
    type: "image",
    clientId: clientId ?? "",
    folder: "",
    tags: "",
    format: "",
  });

  const set = (key: keyof typeof form, val: string) =>
    setForm((p) => ({ ...p, [key]: val }));

  const handleSave = () => {
    if (!form.name || !form.fileUrl) return;
    onSave({
      clientId: form.clientId,
      name: form.name,
      type: form.type,
      fileUrl: form.fileUrl,
      folder: form.folder,
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      format: form.format,
      uploadedBy: "Team",
    });
    setForm({ name: "", fileUrl: "", type: "image", clientId: clientId ?? "", folder: "", tags: "", format: "" });
    onClose();
  };

  const typeLabel = (type: AssetType) => {
    const map: Record<AssetType, string> = {
      image: t("assets.typeImage"),
      video: t("assets.typeVideo"),
      logo: t("assets.typeLogo"),
      brand_file: t("assets.typeBrandFile"),
      document: t("assets.typeDocument"),
      template: t("assets.typeTemplate"),
      caption_template: t("assets.typeCaptionTemplate"),
      hashtag_bank: t("assets.typeHashtagBank"),
      cta_bank: t("assets.typeCtaBank"),
    };
    return map[type] ?? type;
  };

  return (
    <Modal open={open} onClose={onClose} title={t("assets.uploadModal")} maxWidth="520px">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {t("assets.nameLabel")} *
          </label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("assets.namePlaceholder")}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {t("assets.urlLabel")} *
          </label>
          <input
            value={form.fileUrl}
            onChange={(e) => set("fileUrl", e.target.value)}
            placeholder={t("assets.urlPlaceholder")}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Type */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("assets.typeLabel")}
            </label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as AssetType)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            >
              {ASSET_TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {typeLabel(tp)}
                </option>
              ))}
            </select>
          </div>

          {/* Client */}
          {!clientId && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                {t("assets.clientLabel")}
              </label>
              <select
                value={form.clientId}
                onChange={(e) => set("clientId", e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                <option value="">{t("assets.allClients")}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Folder */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("assets.folderLabel")}
            </label>
            <input
              value={form.folder}
              onChange={(e) => set("folder", e.target.value)}
              placeholder={t("assets.folderPlaceholder")}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          {/* Format */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              {t("assets.format")}
            </label>
            <input
              value={form.format}
              onChange={(e) => set("format", e.target.value)}
              placeholder="jpg, mp4, pdf..."
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
            {t("assets.tagsLabel")}
          </label>
          <input
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder={t("assets.tagsPlaceholder")}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" fullWidth onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button fullWidth onClick={handleSave} disabled={!form.name || !form.fileUrl} icon={Plus}>
            {t("assets.uploadBtn")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
