"use client";

import { useState } from "react";
import {
  ImageIcon, Plus, Search, Grid3X3, List, Folder, Trash2,
  FileText, Film, Hash, MessageSquare, Zap, BookOpen, Tag,
  LayoutTemplate, Image,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  "image","video","logo","brand_file","document","template",
  "caption_template","hashtag_bank","cta_bank",
];

const TYPE_ICONS: Record<string, React.ElementType> = {
  image: Image, video: Film, logo: ImageIcon, brand_file: BookOpen,
  document: FileText, template: LayoutTemplate, caption_template: MessageSquare,
  hashtag_bank: Hash, cta_bank: Zap,
};

const TYPE_COLORS: Record<string, string> = {
  image: "#6366f1", video: "#ec4899", logo: "#f59e0b", brand_file: "#14b8a6",
  document: "#64748b", template: "#8b5cf6", caption_template: "#3b82f6",
  hashtag_bank: "#10b981", cta_bank: "#f97316",
};

type ViewMode = "grid" | "list" | "folder";

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "var(--accent)";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide"
      style={{ background: `${color}20`, color }}>
      {type.replace(/_/g, " ")}
    </span>
  );
}

function BankTabContent({
  category, entries, onDelete, onAdd,
}: {
  category: "caption" | "hashtag" | "cta";
  entries: Array<{ id: string; text: string; tags?: string[]; platform?: string }>;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const { t } = useLanguage();
  const icons = { caption: MessageSquare, hashtag: Hash, cta: Zap };
  const colors = { caption: "#3b82f6", hashtag: "#10b981", cta: "#f97316" };
  const Icon = icons[category];
  const color = colors[category];

  return (
    <div>
      {entries.length === 0 ? (
        <EmptyState icon={Icon} title={`No ${category} entries`} description={`Add ${category} entries to your bank.`}
          action={<Button icon={Plus} onClick={onAdd}>Add Entry</Button>} />
      ) : (
        <div className="grid gap-3">
          <AnimatePresence>
            {entries.map((entry) => (
              <motion.div key={entry.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="group flex gap-3 p-4 rounded-xl items-start"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: `${color}15` }}>
                  <Icon size={15} style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{entry.text}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.platform && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        {entry.platform}
                      </span>
                    )}
                    {(entry.tags ?? []).map((tag) => (
                      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px]"
                        style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                        <Tag size={9} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => onDelete(entry.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-red-500/10"
                  style={{ color: "var(--error)" }}>
                  <Trash2 size={14} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

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
  const [form, setForm] = useState({ name: "", type: "image" as AssetType, fileUrl: "", folder: "", tags: "", clientId: "all" });
  const [bankForm, setBankForm] = useState({ text: "", tags: "", platform: "" as ContentPlatform | "", clientId: "all" });

  const filtered = assets.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags ?? []).some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchClient = filterClient === "all" || a.clientId === filterClient;
    const matchType = filterType === "all" || a.type === filterType;
    return matchSearch && matchClient && matchType;
  });

  const handleCreateAsset = async () => {
    if (!form.name || !form.fileUrl) return;
    await createAsset({
      clientId: form.clientId === "all" ? "" : form.clientId,
      name: form.name, type: form.type, fileUrl: form.fileUrl,
      folder: form.folder,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    });
    setForm({ name: "", type: "image", fileUrl: "", folder: "", tags: "", clientId: "all" });
    setModalOpen(false);
  };

  const handleCreateBankEntry = async () => {
    if (!bankForm.text) return;
    await createEntry({
      clientId: bankForm.clientId === "all" ? "" : bankForm.clientId,
      category: bankCategory, text: bankForm.text,
      tags: bankForm.tags ? bankForm.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
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
              <Button variant="secondary" icon={Plus} onClick={() => {
                setBankCategory(activeTab as "caption" | "hashtag" | "cta");
                setBankModalOpen(true);
              }}>Add Entry</Button>
            )}
            {activeTab === "assets" && (
              <Button icon={Plus} onClick={() => setModalOpen(true)}>{t("assets.uploadAsset")}</Button>
            )}
          </div>
        }
      />

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "assets" as const, label: "Assets", count: assets.length },
          { key: "caption" as const, label: t("assets.captionBank"), count: captionEntries.length },
          { key: "hashtag" as const, label: t("assets.hashtagBank"), count: hashtagEntries.length },
          { key: "cta" as const, label: t("assets.ctaBank"), count: ctaEntries.length },
        ]).map(({ key, label, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold whitespace-nowrap transition-all relative"
            style={{ color: activeTab === key ? "var(--accent)" : "var(--text-secondary)" }}>
            {label}
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: activeTab === key ? "var(--accent-dim)" : "var(--surface-3)", color: activeTab === key ? "var(--accent)" : "var(--text-muted)" }}>
              {count}
            </span>
            {activeTab === key && (
              <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                style={{ background: "var(--accent)" }} />
            )}
          </button>
        ))}
      </div>

      {/* Assets Tab */}
      {activeTab === "assets" && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-[200px]">
              <Input placeholder={t("assets.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
            </div>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="all">{t("assets.filterClient")}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="all">{t("assets.filterType")}</option>
              {ASSET_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
            </select>
            <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {([{ mode: "grid" as const, icon: Grid3X3 }, { mode: "list" as const, icon: List }, { mode: "folder" as const, icon: Folder }]).map(({ mode, icon: Icon }) => (
                <button key={mode} onClick={() => setView(mode)}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ background: view === mode ? "var(--surface-3)" : "transparent", color: view === mode ? "var(--text-primary)" : "var(--text-muted)" }}>
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState icon={ImageIcon} title={t("assets.noAssetsTitle")} description={t("assets.noAssetsDesc")}
              action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("assets.uploadAsset")}</Button>} />
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <AnimatePresence>
                {filtered.map((asset) => {
                  const AssetIcon = TYPE_ICONS[asset.type] ?? FileText;
                  const iconColor = TYPE_COLORS[asset.type] ?? "var(--accent)";
                  return (
                    <motion.div key={asset.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                      whileHover={{ y: -3 }} transition={{ duration: 0.2 }}
                      className="group relative rounded-2xl overflow-hidden cursor-pointer"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
                      <div className="relative w-full aspect-square">
                        {asset.thumbnailUrl ? (
                          <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                            style={{ background: `${iconColor}10` }}>
                            <AssetIcon size={32} style={{ color: iconColor }} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button onClick={() => deleteAsset(asset.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: "var(--error)" }}>
                            <Trash2 size={14} color="white" />
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-xs font-semibold truncate mb-1" style={{ color: "var(--text-primary)" }}>{asset.name}</p>
                        <TypeBadge type={asset.type} />
                        {asset.folder && (
                          <p className="text-[10px] mt-1 truncate flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                            <Folder size={9} /> {asset.folder}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : view === "list" ? (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)", color: "var(--text-muted)" }}>
                <span>Type</span><span>Name</span><span>Folder</span><span>Tags</span><span>Date</span><span></span>
              </div>
              <AnimatePresence>
                {filtered.map((asset) => {
                  const AssetIcon = TYPE_ICONS[asset.type] ?? FileText;
                  const iconColor = TYPE_COLORS[asset.type] ?? "var(--accent)";
                  return (
                    <motion.div key={asset.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="group grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 items-center"
                      style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-1)" }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${iconColor}15` }}>
                        <AssetIcon size={16} style={{ color: iconColor }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{asset.name}</p>
                        <TypeBadge type={asset.type} />
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{asset.folder || "—"}</span>
                      <div className="flex gap-1 flex-wrap">
                        {(asset.tags ?? []).slice(0, 2).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded text-[10px]"
                            style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>{tag}</span>
                        ))}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(asset.createdAt).toLocaleDateString()}
                      </span>
                      <button onClick={() => deleteAsset(asset.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg"
                        style={{ color: "var(--error)" }}>
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
            <div className="grid gap-4">
              {folders.map((folder) => {
                const folderAssets = filtered.filter((a) => (a.folder || "Uncategorized") === folder);
                return (
                  <motion.div key={folder} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-3 px-4 py-3"
                      style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                      <Folder size={16} style={{ color: "var(--accent)" }} />
                      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{folder}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{folderAssets.length}</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 p-4" style={{ background: "var(--surface-1)" }}>
                      {folderAssets.map((asset) => {
                        const AssetIcon = TYPE_ICONS[asset.type] ?? FileText;
                        const iconColor = TYPE_COLORS[asset.type] ?? "var(--accent)";
                        return (
                          <div key={asset.id} className="group relative aspect-square rounded-xl overflow-hidden"
                            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                            {asset.thumbnailUrl ? (
                              <img src={asset.thumbnailUrl} alt={asset.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center" style={{ background: `${iconColor}10` }}>
                                <AssetIcon size={20} style={{ color: iconColor }} />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                              <p className="text-white text-[10px] font-medium truncate w-full">{asset.name}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "caption" && (
        <BankTabContent category="caption" entries={captionEntries} onDelete={deleteEntry}
          onAdd={() => { setBankCategory("caption"); setBankModalOpen(true); }} />
      )}
      {activeTab === "hashtag" && (
        <BankTabContent category="hashtag" entries={hashtagEntries} onDelete={deleteEntry}
          onAdd={() => { setBankCategory("hashtag"); setBankModalOpen(true); }} />
      )}
      {activeTab === "cta" && (
        <BankTabContent category="cta" entries={ctaEntries} onDelete={deleteEntry}
          onAdd={() => { setBankCategory("cta"); setBankModalOpen(true); }} />
      )}

      {/* Upload Asset Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("assets.uploadAsset")}>
        <div className="flex flex-col gap-4">
          <Input label="Name *" placeholder="Asset name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Input label="File URL *" placeholder="https://..." value={form.fileUrl} onChange={(v) => setForm((f) => ({ ...f, fileUrl: v }))} />
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AssetType }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {ASSET_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Client</label>
            <select value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="all">No specific client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Folder" placeholder="e.g. Brand Assets" value={form.folder} onChange={(v) => setForm((f) => ({ ...f, folder: v }))} />
          <Input label="Tags (comma separated)" placeholder="tag1, tag2" value={form.tags} onChange={(v) => setForm((f) => ({ ...f, tags: v }))} />
          <Button onClick={handleCreateAsset} disabled={!form.name || !form.fileUrl}>Upload Asset</Button>
        </div>
      </Modal>

      {/* Bank Entry Modal */}
      <Modal open={bankModalOpen} onClose={() => setBankModalOpen(false)} title={`Add ${bankCategory} Entry`}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Text *</label>
            <textarea value={bankForm.text} onChange={(e) => setBankForm((f) => ({ ...f, text: e.target.value }))}
              rows={4} placeholder={`Enter ${bankCategory} text...`}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>Client</label>
            <select value={bankForm.clientId} onChange={(e) => setBankForm((f) => ({ ...f, clientId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              <option value="all">No specific client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Platform" placeholder="e.g. instagram" value={bankForm.platform ?? ""} onChange={(v) => setBankForm((f) => ({ ...f, platform: v as ContentPlatform | "" }))} />
          <Input label="Tags (comma separated)" placeholder="tag1, tag2" value={bankForm.tags} onChange={(v) => setBankForm((f) => ({ ...f, tags: v }))} />
          <Button onClick={handleCreateBankEntry} disabled={!bankForm.text}>Add Entry</Button>
        </div>
      </Modal>
    </div>
  );
}
