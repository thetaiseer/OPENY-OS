"use client";

import { useState } from "react";
import {
  ImageIcon,
  Plus,
  Search,
  Grid3X3,
  List,
  Folder,
  Trash2,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAssets } from "@/lib/AssetsContext";
import { useClients } from "@/lib/AppContext";
import { useBank } from "@/lib/BankContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { AssetType, ContentPlatform } from "@/lib/types";

const ASSET_TYPES: AssetType[] = [
  "image",
  "video",
  "logo",
  "brand_file",
  "document",
  "template",
  "caption_template",
  "hashtag_bank",
  "cta_bank",
];

type ViewMode = "grid" | "list" | "folder";

export default function AssetsPage() {
  const { t } = useLanguage();
  const { assets, createAsset, deleteAsset } = useAssets();
  const { clients } = useClients();
  const { entries: bankEntries, createEntry, deleteEntry } = useBank();

  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [activeTab, setActiveTab] = useState<"assets" | "caption" | "hashtag" | "cta">("assets");
  const [modalOpen, setModalOpen] = useState(false);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankCategory, setBankCategory] = useState<"caption" | "hashtag" | "cta">("caption");
  const [form, setForm] = useState({
    name: "",
    type: "image" as AssetType,
    fileUrl: "",
    folder: "",
    tags: "",
    clientId: "all",
  });
  const [bankForm, setBankForm] = useState({
    text: "",
    tags: "",
    platform: "" as ContentPlatform | "",
    clientId: "all",
  });

  const filtered = assets.filter((a) => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags ?? []).some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchClient = filterClient === "all" || a.clientId === filterClient;
    const matchType = filterType === "all" || a.type === filterType;
    return matchSearch && matchClient && matchType;
  });

  const handleCreateAsset = async () => {
    if (!form.name || !form.fileUrl) return;
    await createAsset({
      clientId: form.clientId === "all" ? "" : form.clientId,
      name: form.name,
      type: form.type,
      fileUrl: form.fileUrl,
      folder: form.folder,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    });
    setForm({ name: "", type: "image", fileUrl: "", folder: "", tags: "", clientId: "all" });
    setModalOpen(false);
  };

  const handleCreateBankEntry = async () => {
    if (!bankForm.text) return;
    await createEntry({
      clientId: bankForm.clientId === "all" ? "" : bankForm.clientId,
      category: bankCategory,
      text: bankForm.text,
      tags: bankForm.tags
        ? bankForm.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      platform: bankForm.platform || undefined,
    });
    setBankForm({ text: "", tags: "", platform: "", clientId: "all" });
    setBankModalOpen(false);
  };

  const folders = [...new Set(filtered.map((a) => a.folder || "Uncategorized"))];

  const captionEntries = bankEntries.filter((e) => e.category === "caption");
  const hashtagEntries = bankEntries.filter((e) => e.category === "hashtag");
  const ctaEntries = bankEntries.filter((e) => e.category === "cta");

  return (
    <div>
      <SectionHeader
        title={t("assets.title")}
        subtitle={`${assets.length} assets · ${clients.length} clients`}
        icon={ImageIcon}
        action={
          <div className="flex gap-2">
            {activeTab !== "assets" && (
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => {
                  setBankCategory(activeTab as "caption" | "hashtag" | "cta");
                  setBankModalOpen(true);
                }}
              >
                Add Entry
              </Button>
            )}
            {activeTab === "assets" && (
              <Button icon={Plus} onClick={() => setModalOpen(true)}>
                {t("assets.uploadAsset")}
              </Button>
            )}
          </div>
        }
      />

      {/* Sub-tabs */}
      <div
        className="flex gap-1 mb-5 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {(
          [
            { key: "assets", label: "Assets" },
            { key: "caption", label: t("assets.captionBank") },
            { key: "hashtag", label: t("assets.hashtagBank") },
            { key: "cta", label: t("assets.ctaBank") },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all"
            style={{
              color: activeTab === key ? "var(--accent)" : "var(--text-secondary)",
              borderBottom:
                activeTab === key ? "2px solid var(--accent)" : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Assets Tab */}
      {activeTab === "assets" && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder={t("assets.searchPlaceholder")}
                value={search}
                onChange={setSearch}
                icon={Search}
              />
            </div>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="all">{t("assets.filterClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="all">{t("assets.filterType")}</option>
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
            {/* View toggle */}
            <div
              className="flex gap-1 rounded-xl p-1"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              {([
                { mode: "grid" as const, icon: Grid3X3 },
                { mode: "list" as const, icon: List },
                { mode: "folder" as const, icon: Folder },
              ]).map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setView(mode)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{
                    background: view === mode ? "var(--surface-3)" : "transparent",
                    color: view === mode ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title={t("assets.noAssetsTitle")}
              description={t("assets.noAssetsDesc")}
              action={
                <Button icon={Plus} onClick={() => setModalOpen(true)}>
                  {t("assets.uploadAsset")}
                </Button>
              }
            />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-xl overflow-hidden"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  {asset.thumbnailUrl ? (
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.name}
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <div
                      className="w-full aspect-square flex items-center justify-center"
                      style={{ background: "var(--surface-3)" }}
                    >
                      <ImageIcon size={28} style={{ color: "var(--text-muted)" }} />
                    </div>
                  )}
                  <div className="p-2">
                    <p
                      className="text-xs font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {asset.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {asset.type.replace("_", " ")}
                    </p>
                    {asset.folder && (
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {asset.folder}
                      </p>
                    )}
                  </div>
                  <button
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(248,113,113,0.9)",
                      color: "white",
                      fontSize: "14px",
                    }}
                    onClick={() => deleteAsset(asset.id)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : view === "list" ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              {filtered.map((asset, i) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:
                      i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    background: "var(--surface-1)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <ImageIcon size={14} style={{ color: "var(--text-muted)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {asset.name}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {asset.type.replace("_", " ")} · {asset.folder || "No folder"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(asset.tags ?? []).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{
                          background: "var(--surface-3)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p
                    className="text-xs flex-shrink-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                  <button
                    onClick={() => deleteAsset(asset.id)}
                    className="p-1 rounded-lg transition-all hover:opacity-70"
                    style={{ color: "var(--error)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            /* Folder view */
            <div className="space-y-6">
              {folders.map((folder) => {
                const folderAssets = filtered.filter(
                  (a) => (a.folder || "Uncategorized") === folder,
                );
                return (
                  <div key={folder}>
                    <div className="flex items-center gap-2 mb-3">
                      <Folder size={15} style={{ color: "var(--accent)" }} />
                      <p
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {folder}
                      </p>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        ({folderAssets.length})
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                      {folderAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="group relative rounded-xl overflow-hidden"
                          style={{
                            background: "var(--surface-2)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {asset.thumbnailUrl ? (
                            <img
                              src={asset.thumbnailUrl}
                              alt={asset.name}
                              className="w-full aspect-square object-cover"
                            />
                          ) : (
                            <div
                              className="w-full aspect-square flex items-center justify-center"
                              style={{ background: "var(--surface-3)" }}
                            >
                              <ImageIcon size={24} style={{ color: "var(--text-muted)" }} />
                            </div>
                          )}
                          <div className="p-2">
                            <p
                              className="text-xs font-medium truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {asset.name}
                            </p>
                          </div>
                          <button
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center"
                            style={{
                              background: "rgba(248,113,113,0.9)",
                              color: "white",
                              fontSize: "14px",
                            }}
                            onClick={() => deleteAsset(asset.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Bank Tabs */}
      {(activeTab === "caption" || activeTab === "hashtag" || activeTab === "cta") && (
        <BankTabContent
          activeTab={activeTab}
          captionEntries={captionEntries}
          hashtagEntries={hashtagEntries}
          ctaEntries={ctaEntries}
          onAdd={() => {
            setBankCategory(activeTab as "caption" | "hashtag" | "cta");
            setBankModalOpen(true);
          }}
          onDelete={deleteEntry}
          t={t}
        />
      )}

      {/* Upload Asset Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t("assets.modalTitle")}
      >
        <div className="space-y-4">
          <Input
            label={t("assets.nameLabel")}
            placeholder={t("assets.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("assets.typeLabel")}
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as AssetType }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t("assets.urlLabel")}
            placeholder={t("assets.urlPlaceholder")}
            value={form.fileUrl}
            onChange={(v) => setForm((p) => ({ ...p, fileUrl: v }))}
            required
          />
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("assets.clientLabel")}
            </label>
            <select
              value={form.clientId}
              onChange={(e) => setForm((p) => ({ ...p, clientId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="all">No specific client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label={t("assets.folderLabel")}
            placeholder={t("assets.folderPlaceholder")}
            value={form.folder}
            onChange={(v) => setForm((p) => ({ ...p, folder: v }))}
          />
          <Input
            label={t("assets.tagsLabel")}
            placeholder={t("assets.tagsPlaceholder")}
            value={form.tags}
            onChange={(v) => setForm((p) => ({ ...p, tags: v }))}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              fullWidth
              onClick={handleCreateAsset}
              disabled={!form.name || !form.fileUrl}
            >
              {t("assets.uploadBtn")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bank Entry Modal */}
      <Modal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        title={`Add ${bankCategory} entry`}
      >
        <div className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("assets.textLabel")}
            </label>
            <textarea
              rows={3}
              value={bankForm.text}
              onChange={(e) => setBankForm((p) => ({ ...p, text: e.target.value }))}
              placeholder={t("assets.textPlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <Input
            label={t("assets.tagsLabel")}
            placeholder={t("assets.tagsPlaceholder")}
            value={bankForm.tags}
            onChange={(v) => setBankForm((p) => ({ ...p, tags: v }))}
          />
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("assets.clientLabel")}
            </label>
            <select
              value={bankForm.clientId}
              onChange={(e) => setBankForm((p) => ({ ...p, clientId: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: "var(--surface-2)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <option value="all">No specific client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setBankModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button fullWidth onClick={handleCreateBankEntry} disabled={!bankForm.text}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Bank Tab Content ──────────────────────────────────────────

function BankTabContent({
  activeTab,
  captionEntries,
  hashtagEntries,
  ctaEntries,
  onAdd,
  onDelete,
  t,
}: {
  activeTab: "caption" | "hashtag" | "cta";
  captionEntries: ReturnType<typeof useBank>["entries"];
  hashtagEntries: ReturnType<typeof useBank>["entries"];
  ctaEntries: ReturnType<typeof useBank>["entries"];
  onAdd: () => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const currentEntries =
    activeTab === "caption"
      ? captionEntries
      : activeTab === "hashtag"
        ? hashtagEntries
        : ctaEntries;
  const label =
    activeTab === "caption"
      ? t("assets.captionBank")
      : activeTab === "hashtag"
        ? t("assets.hashtagBank")
        : t("assets.ctaBank");

  if (currentEntries.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title={`No ${label} entries`}
        description={t("assets.noBankEntries")}
        action={
          <Button icon={Plus} onClick={onAdd}>
            Add Entry
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {currentEntries.map((entry) => (
        <div
          key={entry.id}
          className="group flex items-start gap-3 p-4 rounded-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {entry.text}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {entry.platform && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: "var(--accent-dim)", color: "var(--accent)" }}
                >
                  {entry.platform}
                </span>
              )}
              {(entry.tags ?? []).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
            style={{ color: "var(--error)" }}
            onClick={() => onDelete(entry.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
