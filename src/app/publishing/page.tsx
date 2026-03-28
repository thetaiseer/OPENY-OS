"use client";

// ============================================================
// OPENY OS – Publishing Queue & Scheduled Content Page
// Phase 4: Publishing Workflow
// ============================================================
import { useState, useMemo } from "react";
import {
  Zap,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";
import { usePublishing, computeReadiness } from "@/lib/PublishingContext";
import { useContentItems } from "@/lib/ContentContext";
import { useAppStore } from "@/lib/AppContext";
import { PublishingReadinessBadge } from "@/components/ui/PublishingReadinessBadge";
import { PublishingStatusBadge } from "@/components/ui/PublishingStatusBadge";
import { PublishingActionBar } from "@/components/ui/PublishingActionBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ContentItem } from "@/lib/types";

type SectionKey = "due_now" | "today" | "tomorrow" | "this_week" | "overdue" | "failed" | "published";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Zap; color: string }[] = [
  { key: "due_now", label: "Due Now", icon: Zap, color: "#fbbf24" },
  { key: "today", label: "Today", icon: CalendarDays, color: "#4f8ef7" },
  { key: "tomorrow", label: "Tomorrow", icon: Clock, color: "#a78bfa" },
  { key: "this_week", label: "This Week", icon: CalendarDays, color: "#06b6d4" },
  { key: "overdue", label: "Overdue", icon: AlertTriangle, color: "#f87171" },
  { key: "failed", label: "Failed", icon: AlertTriangle, color: "#f87171" },
  { key: "published", label: "Recently Published", icon: CheckCircle2, color: "#34d399" },
];

export default function PublishingPage() {
  const { contentItems, loading } = useContentItems();
  const { clients } = useAppStore();
  const {
    getDueNowItems,
    getTodayItems,
    getTomorrowItems,
    getThisWeekItems,
    getOverdueItems,
    getFailedItems,
    getRecentlyPublished,
    getPublishingEventForContent,
  } = usePublishing();

  const [activeSection, setActiveSection] = useState<SectionKey>("due_now");
  const [filterClient, setFilterClient] = useState("");
  const [filterPlatform, setFilterPlatform] = useState("");

  // Compute all sections
  const sections = useMemo(() => ({
    due_now: getDueNowItems(contentItems),
    today: getTodayItems(contentItems),
    tomorrow: getTomorrowItems(contentItems),
    this_week: getThisWeekItems(contentItems),
    overdue: getOverdueItems(contentItems),
    failed: getFailedItems(contentItems),
    published: getRecentlyPublished(contentItems),
  }), [
    contentItems,
    getDueNowItems,
    getTodayItems,
    getTomorrowItems,
    getThisWeekItems,
    getOverdueItems,
    getFailedItems,
    getRecentlyPublished,
  ]);

  const activeItems = useMemo(() => {
    let items = sections[activeSection] ?? [];
    if (filterClient) {
      items = items.filter((i) => i.clientId === filterClient);
    }
    if (filterPlatform) {
      items = items.filter((i) => i.platform === filterPlatform);
    }
    return items;
  }, [sections, activeSection, filterClient, filterPlatform]);

  const platforms = ["Facebook", "Instagram", "TikTok", "LinkedIn", "X", "Snapchat", "YouTube"] as const;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Publishing"
        subtitle="Manage your content publishing queue and track statuses"
        icon={Zap}
      />

      {/* Section tabs */}
      <div
        className="flex gap-1 p-1 rounded-2xl overflow-x-auto"
        style={{ background: "var(--surface-3)" }}
      >
        {SECTIONS.map(({ key, label, icon: Icon, color }) => {
          const count = sections[key]?.length ?? 0;
          const isActive = activeSection === key;
          return (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap flex-shrink-0"
              style={{
                background: isActive ? "var(--surface-1)" : "transparent",
                color: isActive ? color : "var(--text-muted)",
              }}
            >
              <Icon size={12} />
              {label}
              {count > 0 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                  style={{
                    background: isActive ? `${color}20` : "var(--surface-2)",
                    color: isActive ? color : "var(--text-muted)",
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={13} style={{ color: "var(--text-muted)" }} />
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-xl outline-none"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-xl outline-none"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <option value="">All Platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Items list */}
      {loading ? (
        <div
          className="text-sm py-10 text-center"
          style={{ color: "var(--text-muted)" }}
        >
          Loading publishing queue…
        </div>
      ) : activeItems.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No items in this section"
          description="Items will appear here based on their scheduled dates and publishing status."
        />
      ) : (
        <div className="space-y-3">
          {activeItems.map((item) => (
            <PublishingQueueItem
              key={item.id}
              item={item}
              clientName={clients.find((c) => c.id === item.clientId)?.name}
              publishingEvent={getPublishingEventForContent(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Queue Item Card ───────────────────────────────────────────

interface QueueItemProps {
  item: ContentItem;
  clientName?: string;
  publishingEvent?: ReturnType<ReturnType<typeof usePublishing>["getPublishingEventForContent"]>;
}

function PublishingQueueItem({ item, clientName, publishingEvent }: QueueItemProps) {
  const readiness = computeReadiness(item);

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className="text-sm font-semibold truncate"
            style={{ color: "var(--text-primary)" }}
          >
            {item.title}
          </h3>
          {clientName && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {clientName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <PublishingReadinessBadge readiness={readiness} />
          {publishingEvent && (
            <PublishingStatusBadge status={publishingEvent.status} />
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
        >
          {item.platform}
        </span>
        <span
          className="text-[11px] px-2 py-0.5 rounded-full capitalize"
          style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}
        >
          {item.contentType}
        </span>
        {item.scheduledDate && (
          <span
            className="flex items-center gap-1 text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            <CalendarDays size={11} />
            {item.scheduledDate}
            {item.scheduledTime && ` · ${item.scheduledTime}`}
          </span>
        )}
        {item.assignedTo && (
          <span
            className="text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            👤 {item.assignedTo}
          </span>
        )}
        <span
          className="text-[10px] px-2 py-0.5 rounded-full capitalize"
          style={{
            background:
              item.approvalStatus === "approved"
                ? "rgba(52,211,153,0.15)"
                : "rgba(251,191,36,0.1)",
            color:
              item.approvalStatus === "approved" ? "#34d399" : "#fbbf24",
          }}
        >
          {item.approvalStatus?.replace(/_/g, " ")}
        </span>
      </div>

      {/* Actions */}
      <PublishingActionBar item={item} />
    </div>
  );
}
