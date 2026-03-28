"use client";

import { useState, useMemo } from "react";
import { Plus, Search, LayoutGrid, List } from "lucide-react";
import { useCampaigns } from "@/lib/CampaignContext";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CampaignModal } from "@/components/campaigns/CampaignModal";
import type { Campaign } from "@/lib/types";

export default function CampaignsPage() {
  const { t } = useLanguage();
  const { campaigns, loading } = useCampaigns();
  const { clients } = useAppStore();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [modalOpen, setModalOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return campaigns.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || c.objective.toLowerCase().includes(q)
    );
  }, [campaigns, search]);

  const openCreate = () => { setEditCampaign(null); setModalOpen(true); };
  const openEdit = (c: Campaign) => { setEditCampaign(c); setModalOpen(true); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            {t("campaigns.title")}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {filtered.length} {t("campaigns.title").toLowerCase()}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "var(--accent)", color: "white" }}
        >
          <Plus size={16} />
          {t("campaigns.newCampaign")}
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("campaigns.searchPlaceholder")}
            className="w-full rounded-xl pl-9 pr-3 py-2 text-sm outline-none transition-all"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
        </div>

        {/* View switcher */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
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

      {/* Content */}
      {loading ? (
        <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
          {t("common.loading")}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{t("campaigns.noTitle")}</p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t("campaigns.noDesc")}</p>
          <button
            onClick={openCreate}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "white" }}
          >
            <Plus size={15} />
            {t("campaigns.newCampaign")}
          </button>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} clients={clients} onClick={() => openEdit(c)} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {["Name", "Client", "Dates", "Status", "Content"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const client = clients.find((cl) => cl.id === c.clientId);
                return (
                  <tr
                    key={c.id}
                    onClick={() => openEdit(c)}
                    className="cursor-pointer transition-all hover:opacity-80"
                    style={{
                      background: i % 2 === 0 ? "var(--surface-1)" : "var(--surface-2)",
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{client?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"} – {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{c.linkedContentCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CampaignModal open={modalOpen} onClose={() => setModalOpen(false)} campaign={editCampaign} />
    </div>
  );
}
