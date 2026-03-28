"use client";

// ============================================================
// OPENY OS – Client Portal Page
// Phase 4: Client Portal
// ============================================================
import { use, useMemo, useState } from "react";
import {
  Users2,
  ClipboardCheck,
  CalendarDays,
  CheckCircle2,
  Megaphone,
  ImageIcon,
  LayoutDashboard,
  ArrowLeft,
  Inbox,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useAppStore } from "@/lib/AppContext";
import { ClientPortalProvider, useClientPortal } from "@/lib/ClientPortalContext";
import { ClientApprovalCard } from "@/components/ui/ClientApprovalCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import type { ContentItem } from "@/lib/types";

type PortalTab =
  | "overview"
  | "awaiting"
  | "calendar"
  | "approved"
  | "campaigns"
  | "assets";

const TABS: { key: PortalTab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "awaiting", label: "Awaiting Approval", icon: ClipboardCheck },
  { key: "calendar", label: "Content Calendar", icon: CalendarDays },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "campaigns", label: "Campaigns", icon: Megaphone },
  { key: "assets", label: "Assets", icon: ImageIcon },
];

// ── Inner portal (needs context) ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PortalContent({ clientId }: { clientId: string }) {
  const {
    client,
    pendingApprovals,
    contentItems,
    publishedItems,
    campaigns,
    assets,
    loading,
    clientApprove,
    clientReject,
    clientRequestChanges,
  } = useClientPortal();

  const [activeTab, setActiveTab] = useState<PortalTab>("overview");

  const awaitingApprovals = useMemo(
    () => pendingApprovals.filter((a) => a.status === "pending_client"),
    [pendingApprovals]
  );

  const approvedApprovals = useMemo(
    () => pendingApprovals.filter((a) => a.status === "approved"),
    [pendingApprovals]
  );

  const scheduledItems = useMemo(
    () =>
      contentItems.filter((i) =>
        ["scheduled", "publishing_ready", "approved"].includes(i.status)
      ),
    [contentItems]
  );

  if (!client && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Users2 size={40} style={{ color: "var(--text-muted)" }} />
        <p style={{ color: "var(--text-muted)" }}>Client not found.</p>
        <Link href="/clients" className="text-sm underline" style={{ color: "var(--accent)" }}>
          Back to Clients
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/clients"
          className="flex items-center gap-1.5 text-xs transition-all"
          style={{ color: "var(--text-muted)" }}
        >
          <ArrowLeft size={13} />
          Back to Clients
        </Link>
      </div>

      {/* Portal identity */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
          style={{ background: client?.color ?? "var(--accent)" }}
        >
          {client?.initials ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-lg font-bold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {client?.name ?? "Loading…"}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Client Portal
          </p>
        </div>
        {awaitingApprovals.length > 0 && (
          <div
            className="px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{
              background: "rgba(251,191,36,0.15)",
              color: "#fbbf24",
            }}
          >
            {awaitingApprovals.length} awaiting review
          </div>
        )}
      </div>

      {/* Tab nav */}
      <div
        className="flex gap-1 p-1 rounded-2xl overflow-x-auto"
        style={{ background: "var(--surface-3)" }}
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeTab === key;
          let badgeCount = 0;
          if (key === "awaiting") badgeCount = awaitingApprovals.length;
          if (key === "approved") badgeCount = approvedApprovals.length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive ? "var(--surface-1)" : "transparent",
                color: isActive ? "var(--accent)" : "var(--text-muted)",
              }}
            >
              <Icon size={12} />
              {label}
              {badgeCount > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: "rgba(251,191,36,0.2)",
                    color: "#fbbf24",
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {loading ? (
        <div
          className="text-sm py-10 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Loading portal…
        </div>
      ) : (
        <>
          {/* Overview */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: "Awaiting Approval",
                  value: awaitingApprovals.length,
                  color: "#fbbf24",
                },
                {
                  label: "Approved Items",
                  value: approvedApprovals.length,
                  color: "#34d399",
                },
                {
                  label: "Scheduled",
                  value: scheduledItems.length,
                  color: "#4f8ef7",
                },
                {
                  label: "Published",
                  value: publishedItems.length,
                  color: "#a78bfa",
                },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="rounded-2xl p-4 text-center"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p
                    className="text-2xl font-bold"
                    style={{ color }}
                  >
                    {value}
                  </p>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </p>
                </div>
              ))}

              {/* Active campaigns summary */}
              {campaigns.length > 0 && (
                <div
                  className="col-span-2 md:col-span-4 rounded-2xl p-4"
                  style={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p
                    className="text-sm font-semibold mb-3"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Active Campaigns
                  </p>
                  <div className="space-y-2">
                    {campaigns
                      .filter((c) => c.status === "active")
                      .slice(0, 3)
                      .map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between py-2"
                          style={{ borderBottom: "1px solid var(--border)" }}
                        >
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {c.name}
                          </span>
                          <Badge label="Active" color="green" />
                        </div>
                      ))}
                    {campaigns.filter((c) => c.status === "active").length === 0 && (
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No active campaigns
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Awaiting Approval */}
          {activeTab === "awaiting" && (
            <div className="space-y-3">
              {awaitingApprovals.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No items awaiting approval"
                  description="All content has been reviewed. Check back soon for new submissions."
                />
              ) : (
                awaitingApprovals.map((approval) => {
                  const content = contentItems.find(
                    (c) => c.id === approval.contentItemId
                  );
                  return (
                    <ClientApprovalCard
                      key={approval.id}
                      approval={approval}
                      contentItem={content}
                      onApprove={clientApprove}
                      onReject={clientReject}
                      onRequestChanges={clientRequestChanges}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Calendar – Show scheduled content */}
          {activeTab === "calendar" && (
            <div className="space-y-3">
              {scheduledItems.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No scheduled content"
                  description="Scheduled content will appear here."
                />
              ) : (
                scheduledItems.map((item) => (
                  <PortalContentCard key={item.id} item={item} />
                ))
              )}
            </div>
          )}

          {/* Approved */}
          {activeTab === "approved" && (
            <div className="space-y-3">
              {approvedApprovals.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No approved items yet"
                  description="Approved content will appear here."
                />
              ) : (
                approvedApprovals.map((approval) => {
                  const content = contentItems.find(
                    (c) => c.id === approval.contentItemId
                  );
                  return (
                    <ClientApprovalCard
                      key={approval.id}
                      approval={approval}
                      contentItem={content}
                      onApprove={clientApprove}
                      onReject={clientReject}
                      onRequestChanges={clientRequestChanges}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Campaigns */}
          {activeTab === "campaigns" && (
            <div className="space-y-3">
              {campaigns.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="No campaigns"
                  description="Campaigns will appear here."
                />
              ) : (
                campaigns.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-2xl p-4"
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3
                        className="text-sm font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {c.name}
                      </h3>
                      <Badge
                        label={c.status}
                        color={
                          c.status === "active"
                            ? "green"
                            : c.status === "completed"
                            ? "blue"
                            : "gray"
                        }
                      />
                    </div>
                    {c.objective && (
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {c.objective}
                      </p>
                    )}
                    {(c.startDate || c.endDate) && (
                      <p
                        className="text-[11px] mt-2"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {c.startDate} → {c.endDate}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Assets */}
          {activeTab === "assets" && (
            <div className="space-y-3">
              {assets.length === 0 ? (
                <EmptyState
                  icon={ImageIcon}
                  title="No assets"
                  description="Shared brand assets will appear here."
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {assets.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl p-3 space-y-2"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div
                        className="w-full aspect-square rounded-xl flex items-center justify-center"
                        style={{ background: "var(--surface-3)" }}
                      >
                        {a.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.thumbnailUrl}
                            alt={a.name}
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <ImageIcon
                            size={24}
                            style={{ color: "var(--text-muted)" }}
                          />
                        )}
                      </div>
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {a.name}
                      </p>
                      <p
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {a.type}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Content Card (read-only for client) ──────────────────────

function PortalContentCard({ item }: { item: ContentItem }) {
  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {item.title}
        </h3>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full capitalize flex-shrink-0"
          style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
        >
          {item.status.replace(/_/g, " ")}
        </span>
      </div>
      {item.caption && (
        <p
          className="text-xs leading-relaxed line-clamp-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {item.caption}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
        >
          {item.platform}
        </span>
        {item.scheduledDate && (
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <CalendarDays size={11} />
            {item.scheduledDate}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page wrapper (provides context) ──────────────────────────

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default function PortalPage({ params }: PageProps) {
  const { clientId } = use(params);
  const { clients } = useAppStore();
  const clientData = clients.find((c) => c.id === clientId) ?? null;

  return (
    <ClientPortalProvider clientId={clientId} clientData={clientData}>
      <PortalContent clientId={clientId} />
    </ClientPortalProvider>
  );
}
