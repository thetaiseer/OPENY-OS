"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  ImageIcon,
  StickyNote,
  Clock,
  BarChart2,
  Mail,
  Phone,
  Globe,
  Building2,
  Target,
  Plus,
  Edit3,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { useClients, useTasks } from "@/lib/AppContext";
import { useContentItems } from "@/lib/ContentContext";
import { useApprovals } from "@/lib/ApprovalContext";
import { useAssets } from "@/lib/AssetsContext";
import { useClientNotes } from "@/lib/ClientNotesContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Client } from "@/lib/types";

// ── Quota Widget ─────────────────────────────────────────────

function QuotaWidget({
  client,
  used,
}: {
  client: Client & { monthlyPostQuota?: number };
  used: number;
}) {
  const { t } = useLanguage();
  const quota = client.monthlyPostQuota ?? 30;
  const pct = Math.min(100, Math.round((used / quota) * 100));
  const color = pct >= 100 ? "var(--error)" : pct >= 80 ? "var(--warning)" : "var(--success)";

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          {t("clientWorkspace.postQuota")}
        </span>
        {pct >= 100 && (
          <div className="flex items-center gap-1">
            <AlertTriangle size={12} style={{ color: "var(--error)" }} />
            <span className="text-xs" style={{ color: "var(--error)" }}>
              {t("clientWorkspace.quotaCritical")}
            </span>
          </div>
        )}
        {pct >= 80 && pct < 100 && (
          <div className="flex items-center gap-1">
            <AlertTriangle size={12} style={{ color: "var(--warning)" }} />
            <span className="text-xs" style={{ color: "var(--warning)" }}>
              {t("clientWorkspace.quotaWarning")}
            </span>
          </div>
        )}
      </div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-bold" style={{ color }}>
          {used}
        </span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          / {quota}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {used} {t("clientWorkspace.postsUsed")}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {Math.max(0, quota - used)} {t("clientWorkspace.postsRemaining")}
        </span>
      </div>
    </div>
  );
}

// ── Notes Panel ──────────────────────────────────────────────

function NotesPanel({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const { filtered, createNote, deleteNote } = useClientNotes(clientId);
  const [activeType, setActiveType] = useState<"internal" | "client_facing">("internal");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ content: "", tag: "" });

  const typeNotes = filtered.filter((n) => n.type === activeType);

  const handleSave = async () => {
    if (!form.content.trim()) return;
    await createNote({
      clientId,
      type: activeType,
      content: form.content,
      author: "Team",
      tag: form.tag,
    });
    setForm({ content: "", tag: "" });
    setModalOpen(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {(["internal", "client_facing"] as const).map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeType === type ? "var(--accent-dim)" : "var(--surface-2)",
              color: activeType === type ? "var(--accent)" : "var(--text-secondary)",
              border: "1px solid " + (activeType === type ? "var(--accent)" : "var(--border)"),
            }}
          >
            {type === "internal"
              ? t("clientWorkspace.internalNotes")
              : t("clientWorkspace.clientFacingNotes")}
          </button>
        ))}
        <div className="flex-1" />
        <Button size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
          {activeType === "internal"
            ? t("clientWorkspace.addInternalNote")
            : t("clientWorkspace.addClientNote")}
        </Button>
      </div>

      {typeNotes.length === 0 ? (
        <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
          <StickyNote size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{t("clientWorkspace.noNotes")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {typeNotes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-xl"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
                    {note.author}
                  </span>
                  {note.tag && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs"
                      style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
                    >
                      {note.tag}
                    </span>
                  )}
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {note.content}
              </p>
              <button
                className="mt-2 text-xs transition-opacity"
                style={{ color: "var(--error)" }}
                onClick={() => deleteNote(note.id)}
              >
                {t("common.delete")}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          activeType === "internal"
            ? t("clientWorkspace.addInternalNote")
            : t("clientWorkspace.addClientNote")
        }
      >
        <div className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("clientWorkspace.noteContent")}
            </label>
            <textarea
              rows={4}
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder={t("clientWorkspace.notePlaceholder")}
              className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <Input
            label={t("clientWorkspace.noteTag")}
            placeholder={t("clientWorkspace.noteTagPlaceholder")}
            value={form.tag}
            onChange={(v) => setForm((p) => ({ ...p, tag: v }))}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              fullWidth
              onClick={handleSave}
              disabled={!form.content.trim()}
            >
              {t("clientWorkspace.saveNote")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────

function TimelinePanel({
  contentItems,
  tasks,
}: {
  clientId: string;
  contentItems: Array<{ id: string; title: string; status: string; createdAt: string }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    completedAt?: string | null;
    createdAt: string;
  }>;
}) {
  const { t } = useLanguage();

  type TimelineEvent = {
    id: string;
    message: string;
    detail: string;
    timestamp: string;
    icon: typeof CheckCircle2;
    color: string;
  };

  const events: TimelineEvent[] = [
    ...contentItems.slice(0, 5).map((c) => ({
      id: `content-${c.id}`,
      message: "Post scheduled",
      detail: c.title,
      timestamp: c.createdAt,
      icon: CalendarDays,
      color: "var(--accent)",
    })),
    ...tasks
      .filter((task) => task.status === "done" && task.completedAt)
      .slice(0, 5)
      .map((task) => ({
        id: `task-${task.id}`,
        message: "Task completed",
        detail: task.title,
        timestamp: task.completedAt!,
        icon: CheckCircle2,
        color: "var(--success)",
      })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  if (events.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: "var(--text-muted)" }}>
        <Clock size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">{t("clientWorkspace.noTimeline")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((ev, i) => {
        const Icon = ev.icon;
        return (
          <div key={ev.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: `${ev.color}20`,
                  border: `1px solid ${ev.color}40`,
                }}
              >
                <Icon size={14} style={{ color: ev.color }} />
              </div>
              {i < events.length - 1 && (
                <div
                  className="w-px flex-1 my-1"
                  style={{ background: "var(--border)", minHeight: "16px" }}
                />
              )}
            </div>
            <div className="pb-4 pt-1 min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {ev.message}
              </p>
              <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                {ev.detail}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {new Date(ev.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Overview Panel ────────────────────────────────────────────

function OverviewPanel({
  client,
  contentItems,
  tasks,
  approvals,
}: {
  client: Client & {
    monthlyPostQuota?: number;
    activePlatforms?: string[];
    packageType?: string;
    industry?: string;
    goals?: string;
    toneOfVoice?: string;
    targetAudience?: string;
  };
  contentItems: Array<{ id: string; status: string; createdAt: string }>;
  tasks: Array<{ id: string; status: string }>;
  approvals: Array<{ id: string; status: string }>;
}) {
  const { t } = useLanguage();

  const publishedCount = contentItems.filter((c) => c.status === "published").length;
  const openTasks = tasks.filter((task) => task.status !== "done").length;
  const pendingApprovals = approvals.filter((a) => a.status.startsWith("pending")).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left column - client info */}
      <div className="lg:col-span-1 space-y-4">
        {/* Contact */}
        <Card>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            {t("clientWorkspace.contactInfo")}
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail size={13} style={{ color: "var(--text-muted)" }} />
              <span
                className="text-sm truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {client.email}
              </span>
            </div>
            {client.phone && (
              <div className="flex items-center gap-2">
                <Phone size={13} style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {client.phone}
                </span>
              </div>
            )}
            {client.website && (
              <div className="flex items-center gap-2">
                <Globe size={13} style={{ color: "var(--text-muted)" }} />
                <span
                  className="text-sm truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {client.website}
                </span>
              </div>
            )}
            {client.industry && (
              <div className="flex items-center gap-2">
                <Building2 size={13} style={{ color: "var(--text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>
                  {client.industry}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Package & Quota */}
        <Card>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            {t("clientWorkspace.package")}
          </p>
          {client.packageType && (
            <div className="mb-3">
              <Badge label={client.packageType} color="blue" />
            </div>
          )}
          <QuotaWidget client={client} used={publishedCount} />
        </Card>

        {/* Active Platforms */}
        {client.activePlatforms && client.activePlatforms.length > 0 && (
          <Card>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: "var(--text-muted)" }}
            >
              {t("clientWorkspace.activePlatforms")}
            </p>
            <div className="flex flex-wrap gap-2">
              {client.activePlatforms.map((p) => (
                <span
                  key={p}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium"
                  style={{
                    background: "var(--surface-2)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Right column */}
      <div className="lg:col-span-2 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: t("nav.content"),
              value: contentItems.length,
              icon: CalendarDays,
              color: "var(--accent)",
            },
            {
              label: t("clientWorkspace.tasks"),
              value: openTasks,
              icon: CheckSquare,
              color: "var(--success)",
            },
            {
              label: t("clientWorkspace.approvals"),
              value: pendingApprovals,
              icon: ClipboardCheck,
              color: "var(--warning)",
            },
            {
              label: "Published",
              value: publishedCount,
              icon: TrendingUp,
              color: "var(--success)",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2"
                style={{ background: `${color}20` }}
              >
                <Icon size={14} style={{ color }} />
              </div>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
                {value}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {label}
              </p>
            </div>
          ))}
        </div>

        {/* Goals */}
        {client.goals && (
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} style={{ color: "var(--accent)" }} />
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                {t("clientWorkspace.goals")}
              </p>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: "var(--text-primary)" }}
            >
              {client.goals}
            </p>
          </Card>
        )}

        {/* Tone + Audience */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {client.toneOfVoice && (
            <Card>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--text-muted)" }}
              >
                {t("clientWorkspace.toneOfVoice")}
              </p>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                {client.toneOfVoice}
              </p>
            </Card>
          )}
          {client.targetAudience && (
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Users size={13} style={{ color: "var(--text-muted)" }} />
                <p
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("clientWorkspace.targetAudience")}
                </p>
              </div>
              <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                {client.targetAudience}
              </p>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <Card>
          <p
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            {t("clientWorkspace.quickActions")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: t("clientWorkspace.newPost"), icon: CalendarDays, href: "/content" },
              { label: t("clientWorkspace.newTask"), icon: CheckSquare, href: "/tasks" },
              { label: t("clientWorkspace.uploadAsset"), icon: ImageIcon, href: "/assets" },
              {
                label: t("clientWorkspace.requestApproval"),
                icon: ClipboardCheck,
                href: "/approvals",
              },
            ].map(({ label, icon: Icon, href }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <Icon size={14} style={{ color: "var(--accent)" }} />
                {label}
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Assets Panel ──────────────────────────────────────────────

function AssetsPanel({ clientId }: { clientId: string }) {
  const { t } = useLanguage();
  const { filtered, createAsset, deleteAsset } = useAssets(clientId);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "image" as const,
    fileUrl: "",
    folder: "",
    tags: "",
  });

  const handleSave = async () => {
    if (!form.name || !form.fileUrl) return;
    await createAsset({
      clientId,
      name: form.name,
      type: form.type,
      fileUrl: form.fileUrl,
      folder: form.folder,
      tags: form.tags ? form.tags.split(",").map((tag) => tag.trim()) : [],
    });
    setForm({ name: "", type: "image", fileUrl: "", folder: "", tags: "" });
    setModalOpen(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {filtered.length} assets
        </p>
        <Button size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
          {t("assets.uploadAsset")}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={t("assets.noAssetsTitle")}
          description={t("assets.noAssetsDesc")}
          action={
            <Button size="sm" icon={Plus} onClick={() => setModalOpen(true)}>
              {t("assets.uploadAsset")}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
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
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {asset.type}
                </p>
              </div>
              <button
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: "var(--error)", color: "white" }}
                onClick={() => deleteAsset(asset.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

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
          <Input
            label={t("assets.urlLabel")}
            placeholder={t("assets.urlPlaceholder")}
            value={form.fileUrl}
            onChange={(v) => setForm((p) => ({ ...p, fileUrl: v }))}
            required
          />
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
              onClick={handleSave}
              disabled={!form.name || !form.fileUrl}
            >
              {t("assets.uploadBtn")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Client Report ─────────────────────────────────────────────

function ClientReportPanel({
  client,
  contentItems,
  tasks,
  approvals,
}: {
  client: Client & { monthlyPostQuota?: number };
  contentItems: Array<{ id: string; status: string }>;
  tasks: Array<{ id: string; status: string; dueDate: string }>;
  approvals: Array<{ id: string; status: string }>;
}) {
  const { t } = useLanguage();

  const quota = client.monthlyPostQuota ?? 30;
  const published = contentItems.filter((c) => c.status === "published").length;
  const planned = contentItems.length;
  const pendingApprovals = approvals.filter((a) => a.status.startsWith("pending")).length;
  const today = new Date();
  const overdueTasks = tasks.filter((task) => {
    if (task.status === "done") return false;
    return new Date(task.dueDate) < today;
  }).length;
  const pct = Math.min(100, Math.round((published / quota) * 100));
  const health =
    pct >= 100
      ? t("reports.critical")
      : overdueTasks > 0
        ? t("reports.warning")
        : t("reports.good");
  const healthColor =
    pct >= 100 ? "var(--error)" : overdueTasks > 0 ? "var(--warning)" : "var(--success)";

  const metrics = [
    { label: t("reports.monthlyQuotaUsed"), value: `${published} / ${quota}`, sub: `${pct}%` },
    { label: t("reports.totalPlanned"), value: planned, sub: undefined },
    { label: t("reports.totalPublished"), value: published, sub: undefined },
    { label: t("reports.pendingApprovals"), value: pendingApprovals, sub: undefined },
    { label: t("reports.delayedTasks"), value: overdueTasks, sub: undefined },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {t("reports.timelineHealth")}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {t("clientWorkspace.reportHealthSub")}
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ background: `${healthColor}20`, color: healthColor }}
        >
          {health}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-xl p-4"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              {label}
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {value}
            </p>
            {sub && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {sub}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Content Plan Tab ──────────────────────────────────────────

function ContentPlanTab({
  contentItems,
}: {
  contentItems: Array<{
    id: string;
    title: string;
    platform: string;
    status: string;
    scheduledDate: string;
    assignedTo: string;
  }>;
}) {
  const { t } = useLanguage();
  const statusColor: Record<string, string> = {
    idea: "var(--text-muted)",
    copywriting: "var(--warning)",
    design: "var(--accent)",
    internal_review: "var(--warning)",
    client_review: "var(--accent)",
    approved: "var(--success)",
    scheduled: "var(--accent)",
    published: "var(--success)",
  };

  if (contentItems.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t("clientWorkspace.noContentTitle")}
        description={t("clientWorkspace.noContentDesc")}
        action={
          <Link href="/content">
            <Button size="sm" icon={Plus}>
              {t("clientWorkspace.newPost")}
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {contentItems.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: statusColor[item.status] ?? "var(--text-muted)" }}
          />
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {item.title}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {item.platform} · {item.scheduledDate}
            </p>
          </div>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: `${statusColor[item.status] ?? "var(--text-muted)"}20`,
              color: statusColor[item.status] ?? "var(--text-muted)",
            }}
          >
            {item.status.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────

function TasksTab({
  tasks,
}: {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string;
    assignee: string;
  }>;
}) {
  const { t } = useLanguage();
  const priorityColor: Record<string, string> = {
    high: "var(--error)",
    medium: "var(--warning)",
    low: "var(--success)",
  };

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CheckSquare}
        title={t("clientWorkspace.noTasksTitle")}
        description={t("clientWorkspace.noTasksDesc")}
        action={
          <Link href="/tasks">
            <Button size="sm" icon={Plus}>
              {t("clientWorkspace.newTask")}
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: task.status === "done" ? "var(--success)" : "var(--text-muted)",
            }}
          />
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-medium truncate"
              style={{
                color: task.status === "done" ? "var(--text-muted)" : "var(--text-primary)",
                textDecoration: task.status === "done" ? "line-through" : "none",
              }}
            >
              {task.title}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {task.assignee} · Due: {task.dueDate}
            </p>
          </div>
          <span
            className="text-xs"
            style={{ color: priorityColor[task.priority] ?? "var(--text-muted)" }}
          >
            {task.priority}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Approvals Tab ─────────────────────────────────────────────

function ApprovalsTab({
  approvals,
}: {
  approvals: Array<{ id: string; status: string; contentItemId: string; createdAt: string }>;
}) {
  const { t } = useLanguage();
  const statusColor: Record<string, string> = {
    pending_internal: "var(--warning)",
    pending_client: "var(--accent)",
    approved: "var(--success)",
    rejected: "var(--error)",
    revision_requested: "var(--warning)",
  };

  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title={t("clientWorkspace.noApprovalsTitle")}
        description={t("clientWorkspace.noApprovalsDesc")}
      />
    );
  }

  const groups: Record<string, typeof approvals> = {
    pending_internal: approvals.filter((a) => a.status === "pending_internal"),
    pending_client: approvals.filter((a) => a.status === "pending_client"),
    approved: approvals.filter((a) => a.status === "approved"),
    rejected: approvals.filter((a) => a.status === "rejected"),
  };

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([status, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={status}>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: statusColor[status] ?? "var(--text-muted)" }}
            >
              {status.replace("_", " ")} ({items.length})
            </p>
            <div className="space-y-2">
              {items.map((a) => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Content: {a.contentItemId}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MAIN CLIENT WORKSPACE PAGE ────────────────────────────────

const TAB_ICONS = {
  overview: LayoutDashboard,
  contentPlan: CalendarDays,
  tasks: CheckSquare,
  approvals: ClipboardCheck,
  assets: ImageIcon,
  notes: StickyNote,
  timeline: Clock,
  reports: BarChart2,
};

export default function ClientWorkspacePage() {
  const params = useParams();
  const clientId = params.id as string;
  const { t } = useLanguage();
  const { clients } = useClients();
  const { contentItems } = useContentItems();
  const { tasks } = useTasks();
  const { approvals } = useApprovals();

  const client = clients.find((c) => c.id === clientId);

  const clientContent = contentItems.filter((c) => c.clientId === clientId);
  const clientTasks = tasks.filter((task) => task.clientId === clientId);
  const clientApprovals = approvals.filter((a) => a.clientId === clientId);

  const [activeTab, setActiveTab] = useState<keyof typeof TAB_ICONS>("overview");

  const tabs = (Object.keys(TAB_ICONS) as Array<keyof typeof TAB_ICONS>).map((key) => ({
    key,
    label: t(`clientWorkspace.${key}`),
    icon: TAB_ICONS[key],
  }));

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <p style={{ color: "var(--text-muted)" }}>{t("clientWorkspace.clientNotFound")}</p>
          <Link
            href="/clients"
            className="mt-2 inline-block text-sm"
            style={{ color: "var(--accent)" }}
          >
            {t("clientWorkspace.backToClients")}
          </Link>
        </div>
      </div>
    );
  }

  const extClient = client as Client & {
    monthlyPostQuota?: number;
    activePlatforms?: string[];
    packageType?: string;
    industry?: string;
    goals?: string;
    toneOfVoice?: string;
    targetAudience?: string;
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-xs mb-4 transition-opacity hover:opacity-70"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={13} />
          {t("clientWorkspace.backToClients")}
        </Link>
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
            style={{ background: client.color }}
          >
            {client.initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {client.name}
              </h1>
              <Badge
                label={client.status}
                color={
                  client.status === "active"
                    ? "green"
                    : client.status === "prospect"
                      ? "blue"
                      : "gray"
                }
              />
            </div>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {client.company}
              {extClient.industry ? ` · ${extClient.industry}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/portal/${client.id}`}>
              <Button variant="secondary" size="sm">
                {t("nav.portal")}
              </Button>
            </Link>
            <Button variant="secondary" size="sm" icon={Edit3}>
              {t("clientWorkspace.editProfile")}
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="flex overflow-x-auto gap-1 mb-6 pb-1"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg whitespace-nowrap text-xs font-medium transition-all flex-shrink-0"
            style={{
              color: activeTab === key ? "var(--accent)" : "var(--text-secondary)",
              borderBottom:
                activeTab === key ? "2px solid var(--accent)" : "2px solid transparent",
              background: "transparent",
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && (
          <OverviewPanel
            client={extClient}
            contentItems={clientContent}
            tasks={clientTasks}
            approvals={clientApprovals}
          />
        )}
        {activeTab === "contentPlan" && <ContentPlanTab contentItems={clientContent} />}
        {activeTab === "tasks" && <TasksTab tasks={clientTasks} />}
        {activeTab === "approvals" && <ApprovalsTab approvals={clientApprovals} />}
        {activeTab === "assets" && <AssetsPanel clientId={clientId} />}
        {activeTab === "notes" && <NotesPanel clientId={clientId} />}
        {activeTab === "timeline" && (
          <TimelinePanel
            clientId={clientId}
            contentItems={clientContent}
            tasks={tasks}
          />
        )}
        {activeTab === "reports" && (
          <ClientReportPanel
            client={extClient}
            contentItems={clientContent}
            tasks={clientTasks}
            approvals={clientApprovals}
          />
        )}
      </div>
    </div>
  );
}
