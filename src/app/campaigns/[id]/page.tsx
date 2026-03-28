"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Edit2, CalendarDays, FileText, CheckSquare, AlignLeft, Clock } from "lucide-react";
import { useCampaigns } from "@/lib/CampaignContext";
import { useContentItems } from "@/lib/ContentContext";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { CampaignModal } from "@/components/campaigns/CampaignModal";

type Tab = "overview" | "content" | "tasks" | "timeline" | "notes";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:     { bg: "var(--surface-3)", color: "var(--text-muted)" },
  planned:   { bg: "#3b82f620", color: "#3b82f6" },
  active:    { bg: "#10b98120", color: "#10b981" },
  paused:    { bg: "#f59e0b20", color: "#f59e0b" },
  completed: { bg: "#8b5cf620", color: "#8b5cf6" },
  archived:  { bg: "#6b728020", color: "#6b7280" },
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft:     "campaigns.statusDraft",
  planned:   "campaigns.statusPlanned",
  active:    "campaigns.statusActive",
  paused:    "campaigns.statusPaused",
  completed: "campaigns.statusCompleted",
  archived:  "campaigns.statusArchived",
};

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const { campaigns } = useCampaigns();
  const { contentItems } = useContentItems();
  const { clients, tasks } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [editOpen, setEditOpen] = useState(false);

  const campaign = campaigns.find((c) => c.id === id);
  const client = clients.find((c) => c.id === campaign?.clientId);
  const linkedContent = useMemo(
    () => contentItems.filter((ci) => ci.campaignId === id),
    [contentItems, id]
  );
  const linkedTasks = useMemo(
    () => tasks.filter((t) => t.projectId === id || (campaign && t.title.includes(campaign.name))),
    [tasks, id, campaign]
  );

  if (!campaign) {
    return (
      <div className="text-center py-16">
        <p style={{ color: "var(--text-muted)" }}>Campaign not found.</p>
        <button onClick={() => router.push("/campaigns")} className="mt-4 text-sm" style={{ color: "var(--accent)" }}>
          ← Back to Campaigns
        </button>
      </div>
    );
  }

  const statusStyle = STATUS_STYLES[campaign.status] ?? STATUS_STYLES.draft;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview",  label: t("campaigns.viewOverview") },
    { key: "content",   label: t("campaigns.viewContent") },
    { key: "tasks",     label: t("campaigns.viewTasks") },
    { key: "timeline",  label: t("campaigns.viewTimeline") },
    { key: "notes",     label: t("campaigns.viewNotes") },
  ];

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/campaigns")}
          className="p-2 rounded-xl transition-all mt-0.5"
          style={{ background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {campaign.name}
            </h1>
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: statusStyle.bg, color: statusStyle.color }}>
              {t((STATUS_LABEL_KEYS[campaign.status] ?? "campaigns.statusDraft") as Parameters<typeof t>[0])}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {client && <span className="text-xs" style={{ color: "var(--text-muted)" }}>{client.name}</span>}
            {(campaign.startDate || campaign.endDate) && (
              <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <CalendarDays size={12} />
                <span className="text-xs">
                  {campaign.startDate ? new Date(campaign.startDate).toLocaleDateString() : "—"} – {campaign.endDate ? new Date(campaign.endDate).toLocaleDateString() : "—"}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
          style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <Edit2 size={14} />
          {t("common.edit")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "var(--surface-3)" }}>
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeTab === key ? "var(--surface-1)" : "transparent",
              color: activeTab === key ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Info card */}
          <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("campaigns.overview")}</p>
            {[
              { label: t("campaigns.objectiveLabel"), value: campaign.objective },
              { label: t("campaigns.audienceLabel"),  value: campaign.targetAudience },
              { label: t("campaigns.budgetLabel"),     value: campaign.budget ? `$${campaign.budget.toLocaleString()}` : "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{value || "—"}</p>
              </div>
            ))}
            {campaign.platforms.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>{t("campaigns.platformsLabel")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {campaign.platforms.map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-md text-xs" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: t("campaigns.linkedContent"), value: linkedContent.length, icon: FileText },
              { label: t("campaigns.linkedTasks"),   value: linkedTasks.length,   icon: CheckSquare },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <Icon size={20} style={{ color: "var(--accent)" }} className="mb-2" />
                <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "content" && (
        <div className="space-y-3">
          {linkedContent.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("campaigns.linkedContent")}: 0</p>
            </div>
          ) : (
            linkedContent.map((ci) => (
              <div key={ci.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{ci.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{ci.platform} · {ci.status}</p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px]" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                  {ci.contentType}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-3">
          {linkedTasks.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare size={32} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>{t("campaigns.linkedTasks")}: 0</p>
            </div>
          ) : (
            linkedTasks.map((task) => (
              <div key={task.id} className="rounded-xl p-4 flex items-center gap-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{task.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{task.assignee} · {task.dueDate}</p>
                </div>
                <span className="px-2 py-0.5 rounded-md text-[11px]" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  {task.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 mb-4">
            <Clock size={16} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("campaigns.viewTimeline")}</p>
          </div>
          <div className="space-y-4">
            {[
              { label: "Campaign Start", date: campaign.startDate, color: "#10b981" },
              { label: "Campaign End",   date: campaign.endDate,   color: "#ef4444" },
            ].map(({ label, date, color }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {date ? new Date(date).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3 mb-4">
            <AlignLeft size={16} style={{ color: "var(--accent)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("campaigns.viewNotes")}</p>
          </div>
          {campaign.notes ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
              {campaign.notes}
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No notes yet. Edit the campaign to add notes.</p>
          )}
        </div>
      )}

      <CampaignModal open={editOpen} onClose={() => setEditOpen(false)} campaign={campaign} />
    </div>
  );
}
