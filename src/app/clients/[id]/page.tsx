"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  Pencil,
  Plus,
  LayoutGrid,
  List,
  CalendarDays,
  Megaphone,
  CheckSquare,
  ClipboardCheck,
  ImageIcon,
  StickyNote,
  Clock,
  BarChart3,
  Package,
  Tag,
  Target,
  Users2,
  Palette,
} from "lucide-react";
import { useAppStore, useClients } from "@/lib/AppContext";
import { useCampaigns } from "@/lib/CampaignContext";
import { useContentItems } from "@/lib/ContentContext";
import { useClientNotes } from "@/lib/ClientNotesContext";
import { useAssets } from "@/lib/AssetContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ClientQuotaWidget } from "@/components/workspace/ClientQuotaWidget";
import { ClientTimeline } from "@/components/workspace/ClientTimeline";
import { ClientNotesPanel } from "@/components/workspace/ClientNotesPanel";
import { AssetsGrid } from "@/components/assets/AssetsGrid";
import { AssetsList } from "@/components/assets/AssetsList";
import { AssetUploadModal } from "@/components/assets/AssetUploadModal";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CampaignModal } from "@/components/campaigns/CampaignModal";
import type { Campaign, ClientActivity, ClientNoteType } from "@/lib/types";

const STATUS_COLOR: Record<string, "green" | "blue" | "gray"> = {
  active: "green",
  prospect: "blue",
  inactive: "gray",
};

type WorkspaceTab =
  | "overview"
  | "content"
  | "campaigns"
  | "tasks"
  | "approvals"
  | "assets"
  | "notes"
  | "timeline"
  | "reports";

// Build client activity timeline from related data
function buildTimeline(
  clientId: string,
  contentItems: ReturnType<typeof useContentItems>["contentItems"],
  campaigns: Campaign[],
  tasks: ReturnType<typeof useAppStore>["tasks"],
): ClientActivity[] {
  const events: ClientActivity[] = [];

  campaigns
    .filter((c) => c.clientId === clientId)
    .forEach((c) =>
      events.push({
        id: `campaign-${c.id}`,
        clientId,
        type: "campaign_created",
        message: `Campaign created: ${c.name}`,
        detail: c.objective,
        entityId: c.id,
        timestamp: c.createdAt,
      })
    );

  contentItems
    .filter((i) => i.clientId === clientId && i.status === "published")
    .forEach((i) =>
      events.push({
        id: `published-${i.id}`,
        clientId,
        type: "post_approved",
        message: `Post published: ${i.title}`,
        detail: i.platform,
        entityId: i.id,
        timestamp: i.publishedAt ?? i.updatedAt,
      })
    );

  contentItems
    .filter((i) => i.clientId === clientId && i.status === "scheduled")
    .forEach((i) =>
      events.push({
        id: `scheduled-${i.id}`,
        clientId,
        type: "post_scheduled",
        message: `Post scheduled: ${i.title}`,
        detail: i.platform,
        entityId: i.id,
        timestamp: i.updatedAt,
      })
    );

  tasks
    .filter((t) => t.status === "done")
    .slice(0, 5)
    .forEach((task) =>
      events.push({
        id: `task-${task.id}`,
        clientId,
        type: "task_completed",
        message: `Task completed: ${task.title}`,
        entityId: task.id,
        timestamp: task.completedAt ?? task.createdAt,
      })
    );

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export default function ClientWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clientId } = use(params);
  const { t } = useLanguage();
  const { clients, tasks } = useAppStore();
  const { updateClient } = useClients();
  const { campaigns } = useCampaigns();
  const { contentItems } = useContentItems();
  const { notes, createNote, deleteNote, getClientNotes } = useClientNotes();
  const { assets, createAsset, deleteAsset, getClientAssets } = useAssets();

  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [assetView, setAssetView] = useState<"grid" | "list">("grid");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", industry: "", packageType: "", monthlyPostQuota: "", toneOfVoice: "", targetAudience: "", goals: "" });

  const client = clients.find((c) => c.id === clientId);
  const clientCampaigns = useMemo(
    () => campaigns.filter((c) => c.clientId === clientId),
    [campaigns, clientId]
  );
  const clientContent = useMemo(
    () => contentItems.filter((i) => i.clientId === clientId),
    [contentItems, clientId]
  );
  const clientNotes = getClientNotes(clientId);
  const clientAssets = getClientAssets(clientId);
  const clientTasks = useMemo(
    () => tasks.filter((t) => clientContent.some((ci) => ci.campaignId && t.project === ci.campaignId)),
    [tasks, clientContent]
  );
  const allClientTasks = tasks; // show all tasks since we don't have clientId on tasks

  const pendingApprovals = clientContent.filter(
    (i) => i.approvalStatus === "pending_internal" || i.approvalStatus === "pending_client"
  );

  const quota = client?.monthlyPostQuota ?? 0;
  const usedPosts = clientContent.filter(
    (i) => i.status === "published" || i.status === "scheduled"
  ).length;

  const timeline = useMemo(
    () => buildTimeline(clientId, clientContent, clientCampaigns, allClientTasks),
    [clientId, clientContent, clientCampaigns, allClientTasks]
  );

  const openEditClient = () => {
    if (!client) return;
    setEditForm({
      name: client.name,
      email: client.email,
      phone: client.phone ?? "",
      industry: client.industry ?? "",
      packageType: client.packageType ?? "",
      monthlyPostQuota: String(client.monthlyPostQuota ?? ""),
      toneOfVoice: client.toneOfVoice ?? "",
      targetAudience: client.targetAudience ?? "",
      goals: client.goals ?? "",
    });
    setEditClientOpen(true);
  };

  const handleSaveClient = () => {
    if (!client) return;
    updateClient(client.id, {
      name: editForm.name,
      email: editForm.email,
      phone: editForm.phone || undefined,
      industry: editForm.industry || undefined,
      packageType: editForm.packageType || undefined,
      monthlyPostQuota: editForm.monthlyPostQuota ? Number(editForm.monthlyPostQuota) : undefined,
      toneOfVoice: editForm.toneOfVoice || undefined,
      targetAudience: editForm.targetAudience || undefined,
      goals: editForm.goals || undefined,
      updatedAt: new Date().toISOString(),
    });
    setEditClientOpen(false);
  };

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p style={{ color: "var(--text-muted)" }}>Client not found.</p>
        <Link href="/clients" className="mt-4 text-sm" style={{ color: "var(--accent)" }}>
          {t("workspace.backToClients")}
        </Link>
      </div>
    );
  }

  const TABS: { key: WorkspaceTab; label: string; icon: typeof CalendarDays }[] = [
    { key: "overview", label: t("workspace.overview"), icon: BarChart3 },
    { key: "content", label: t("workspace.contentPlan"), icon: CalendarDays },
    { key: "campaigns", label: t("workspace.campaigns"), icon: Megaphone },
    { key: "tasks", label: t("workspace.tasks"), icon: CheckSquare },
    { key: "approvals", label: t("workspace.approvals"), icon: ClipboardCheck },
    { key: "assets", label: t("workspace.assets"), icon: ImageIcon },
    { key: "notes", label: t("workspace.notes"), icon: StickyNote },
    { key: "timeline", label: t("workspace.timeline"), icon: Clock },
  ];

  return (
    <div className="space-y-5">
      {/* Back link */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-2 text-sm transition-all"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeft size={14} />
        {t("workspace.backToClients")}
      </Link>

      {/* Client header */}
      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-4 flex-wrap">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: client.color }}
          >
            {client.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {client.name}
              </h1>
              <Badge
                label={t(`status.${client.status}`) || client.status}
                color={STATUS_COLOR[client.status]}
              />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
              {client.email && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Mail size={11} /> {client.email}
                </span>
              )}
              {client.phone && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Phone size={11} /> {client.phone}
                </span>
              )}
              {client.website && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Globe size={11} /> {client.website}
                </span>
              )}
              {client.industry && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Building2 size={11} /> {client.industry}
                </span>
              )}
              {client.packageType && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Package size={11} /> {client.packageType}
                </span>
              )}
            </div>
          </div>
          <Button variant="secondary" size="sm" icon={Pencil} onClick={openEditClient}>
            {t("workspace.editClient")}
          </Button>
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {[
            { label: t("workspace.campaignCount"), value: clientCampaigns.length, color: "#a78bfa" },
            { label: t("workspace.contentCount"), value: clientContent.length, color: "var(--accent)" },
            { label: t("workspace.approvalCount"), value: pendingApprovals.length, color: "#fbbf24" },
            { label: t("workspace.assetCount"), value: clientAssets.length, color: "#34d399" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold" style={{ color }}>
                {value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Quota widget (if configured) */}
      {quota > 0 && <ClientQuotaWidget quota={quota} used={usedPosts} />}

      {/* Tab navigation */}
      <div className="flex overflow-x-auto gap-1 pb-1" style={{ scrollbarWidth: "none" }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={{
                background: isActive ? "var(--accent-dim)" : "var(--surface-2)",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                border: `1px solid ${isActive ? "rgba(79,142,247,0.3)" : "var(--border)"}`,
              }}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {/* ── OVERVIEW ────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* Quick actions */}
            <div
              className="rounded-2xl p-4"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
                {t("workspace.quickActions")}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" icon={Plus} onClick={() => setTab("content")}>{t("workspace.newPost")}</Button>
                <Button size="sm" variant="secondary" icon={Megaphone} onClick={() => { setEditCampaign(null); setCampaignModalOpen(true); }}>{t("workspace.newCampaign")}</Button>
                <Button size="sm" variant="secondary" icon={ImageIcon} onClick={() => setUploadOpen(true)}>{t("workspace.uploadAsset")}</Button>
                <Button size="sm" variant="secondary" icon={StickyNote} onClick={() => setTab("notes")}>{t("workspace.addNote")}</Button>
              </div>
            </div>

            {/* Client details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {t("workspace.contactInfo")}
                </p>
                {[
                  { icon: Mail, label: client.email },
                  { icon: Phone, label: client.phone },
                  { icon: Globe, label: client.website },
                  { icon: Building2, label: client.industry },
                ].filter((r) => r.label).map(({ icon: Icon, label }, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Icon size={13} style={{ color: "var(--text-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{label}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  {t("workspace.packageInfo")}
                </p>
                {[
                  { icon: Package, label: `${t("workspace.packageInfo")}: ${client.packageType ?? "—"}` },
                  { icon: Target, label: `${t("workspace.toneOfVoice")}: ${client.toneOfVoice ?? "—"}` },
                  { icon: Users2, label: `${t("workspace.targetAudience")}: ${client.targetAudience ?? "—"}` },
                  { icon: Tag, label: `${t("workspace.goals")}: ${client.goals ?? "—"}` },
                ].map(({ icon: Icon, label }, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Icon size={13} className="flex-shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active platforms */}
            {client.activePlatforms && client.activePlatforms.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                  {t("workspace.activePlatforms")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {client.activePlatforms.map((p) => (
                    <span key={p} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Brand colors */}
            {client.brandColors && client.brandColors.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                  {t("workspace.brandColors")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {client.brandColors.map((color, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg border" style={{ background: color, borderColor: "var(--border)" }} />
                      <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTENT PLAN ─────────────────────────────────────── */}
        {tab === "content" && (
          <div>
            {clientContent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <CalendarDays size={32} style={{ color: "var(--text-muted)" }} />
                <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{t("workspace.noContent")}</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {clientContent.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.platform}</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>·</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{item.scheduledDate || "—"}</span>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}>
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CAMPAIGNS ────────────────────────────────────────── */}
        {tab === "campaigns" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button icon={Plus} size="sm" onClick={() => { setEditCampaign(null); setCampaignModalOpen(true); }}>
                {t("workspace.newCampaign")}
              </Button>
            </div>
            {clientCampaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <Megaphone size={32} style={{ color: "var(--text-muted)" }} />
                <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{t("workspace.noCampaigns")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {clientCampaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    clients={clients}
                    onClick={() => { setEditCampaign(c); setCampaignModalOpen(true); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TASKS ─────────────────────────────────────────────── */}
        {tab === "tasks" && (
          <div>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <CheckSquare size={32} style={{ color: "var(--text-muted)" }} />
                <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{t("workspace.noTasks")}</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {tasks.slice(0, 20).map((task, idx) => (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)", textDecoration: task.status === "done" ? "line-through" : undefined }}>{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{task.assignee}</span>
                        {task.dueDate && <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {task.dueDate}</span>}
                      </div>
                    </div>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: task.priority === "high" ? "rgba(248,113,113,0.15)" : task.priority === "medium" ? "rgba(251,191,36,0.15)" : "var(--surface-3)",
                        color: task.priority === "high" ? "#f87171" : task.priority === "medium" ? "#fbbf24" : "var(--text-secondary)",
                      }}
                    >
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── APPROVALS ────────────────────────────────────────── */}
        {tab === "approvals" && (
          <div>
            {pendingApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <ClipboardCheck size={32} style={{ color: "var(--text-muted)" }} />
                <p className="mt-3 text-sm" style={{ color: "var(--text-muted)" }}>No pending approvals</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                {pendingApprovals.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{item.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{item.platform} · {item.scheduledDate || "—"}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
                      {item.approvalStatus.replace(/_/g, " ")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ASSETS ───────────────────────────────────────────── */}
        {tab === "assets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--surface-3)" }}>
                {(["grid", "list"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setAssetView(v)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{
                      background: assetView === v ? "var(--surface-1)" : "transparent",
                      color: assetView === v ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {v === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
                  </button>
                ))}
              </div>
              <Button icon={Plus} size="sm" onClick={() => setUploadOpen(true)}>
                {t("workspace.uploadAsset")}
              </Button>
            </div>
            {assetView === "grid" ? (
              <AssetsGrid assets={clientAssets} onDelete={deleteAsset} />
            ) : (
              <AssetsList assets={clientAssets} onDelete={deleteAsset} />
            )}
          </div>
        )}

        {/* ── NOTES ────────────────────────────────────────────── */}
        {tab === "notes" && (
          <ClientNotesPanel
            notes={clientNotes}
            onAdd={(type: ClientNoteType, content: string, tag?: string) =>
              createNote({ clientId, type, content, tag, author: "Team" })
            }
            onDelete={deleteNote}
          />
        )}

        {/* ── TIMELINE ─────────────────────────────────────────── */}
        {tab === "timeline" && <ClientTimeline activities={timeline} />}

        {/* ── REPORTS ──────────────────────────────────────────── */}
        {tab === "reports" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: t("reports.totalContentPlanned"), value: clientContent.length, color: "var(--accent)" },
                { label: t("reports.totalContentPublished"), value: clientContent.filter((i) => i.status === "published").length, color: "#34d399" },
                { label: t("reports.pendingApprovalsCount"), value: pendingApprovals.length, color: "#fbbf24" },
                { label: t("reports.activeCampaigns"), value: clientCampaigns.filter((c) => c.status === "active").length, color: "#a78bfa" },
                { label: t("workspace.assetCount"), value: clientAssets.length, color: "#4f8ef7" },
                { label: t("workspace.noteTag"), value: clientNotes.length, color: "#8888a0" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                </div>
              ))}
            </div>
            {quota > 0 && <ClientQuotaWidget quota={quota} used={usedPosts} />}
          </div>
        )}
      </div>

      {/* Campaign modal */}
      <CampaignModal
        open={campaignModalOpen}
        onClose={() => { setCampaignModalOpen(false); setEditCampaign(null); }}
        campaign={editCampaign}
      />

      {/* Asset upload modal */}
      <AssetUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSave={(data) => createAsset({ ...data, clientId })}
        clientId={clientId}
        clients={[client]}
      />

      {/* Edit client modal */}
      <Modal open={editClientOpen} onClose={() => setEditClientOpen(false)} title={t("workspace.editClient")} maxWidth="540px">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "name" as const, label: t("clients.nameLabel"), placeholder: t("clients.namePlaceholder") },
              { key: "email" as const, label: t("clients.emailLabel"), placeholder: "contact@company.com" },
              { key: "phone" as const, label: "Phone", placeholder: "+1 234 567 8900" },
              { key: "industry" as const, label: t("workspace.industry"), placeholder: "e.g. Retail, Tech, F&B" },
              { key: "packageType" as const, label: t("workspace.packageInfo"), placeholder: "e.g. Growth, Pro" },
              { key: "monthlyPostQuota" as const, label: "Monthly Post Quota", placeholder: "e.g. 30" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
                <input
                  value={editForm[key]}
                  onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            ))}
          </div>
          {[
            { key: "toneOfVoice" as const, label: t("workspace.toneOfVoice"), placeholder: "Professional, Casual, Playful..." },
            { key: "targetAudience" as const, label: t("workspace.targetAudience"), placeholder: "Describe the target audience..." },
            { key: "goals" as const, label: t("workspace.goals"), placeholder: "Brand awareness, lead generation..." },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
              <textarea
                value={editForm[key]}
                onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={2}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                style={{ background: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          ))}
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" fullWidth onClick={() => setEditClientOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleSaveClient}>{t("common.save")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
