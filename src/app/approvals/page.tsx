"use client";

import { useState, useMemo } from "react";
import {
  X, CheckCircle2, Clock, RotateCcw, XCircle, FileCheck,
  MessageSquare, Users, AlertTriangle, ChevronDown, SortAsc,
  LayoutGrid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApprovals } from "@/lib/ApprovalContext";
import { useContentItems } from "@/lib/ContentContext";
import { useAppStore } from "@/lib/AppContext";
import { useLanguage } from "@/lib/LanguageContext";
import { ApprovalCard } from "@/components/approvals/ApprovalCard";
import { ApprovalCommentThread } from "@/components/approvals/ApprovalCommentThread";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Approval, ApprovalWorkflowStatus } from "@/lib/types";

type FilterTab = "all" | ApprovalWorkflowStatus;
type SortMode = "newest" | "updated";

const TABS: { key: FilterTab; label: string; icon: React.ElementType; color: string }[] = [
  { key: "all",                label: "All",               icon: LayoutGrid,    color: "var(--text-secondary)" },
  { key: "pending_internal",   label: "Pending Internal",  icon: Users,         color: "#4f8ef7" },
  { key: "pending_client",     label: "Pending Client",    icon: Clock,         color: "#fbbf24" },
  { key: "approved",           label: "Approved",          icon: CheckCircle2,  color: "#34d399" },
  { key: "rejected",           label: "Rejected",          icon: XCircle,       color: "#f87171" },
  { key: "revision_requested", label: "Revision",          icon: RotateCcw,     color: "#a78bfa" },
];

const STATUS_CONFIG: Record<ApprovalWorkflowStatus, { label: string; color: "red" | "yellow" | "blue" | "green" | "purple" | "gray"; accent: string }> = {
  pending_internal:   { label: "Pending Internal",  color: "blue",   accent: "#4f8ef7" },
  pending_client:     { label: "Pending Client",     color: "yellow", accent: "#fbbf24" },
  approved:           { label: "Approved",           color: "green",  accent: "#34d399" },
  rejected:           { label: "Rejected",           color: "red",    accent: "#f87171" },
  revision_requested: { label: "Revision Requested", color: "purple", accent: "#a78bfa" },
};

export default function ApprovalsPage() {
  const { t } = useLanguage();
  const { approvals, loading, addInternalComment, addClientComment, updateApprovalStatus } = useApprovals();
  const { contentItems } = useContentItems();
  const { clients } = useAppStore();

  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);

  const filtered = useMemo(() => {
    let list = activeTab === "all" ? approvals : approvals.filter(a => a.status === activeTab);
    if (sortMode === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sortMode === "updated") list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [approvals, activeTab, sortMode]);

  const liveSelected = selectedApproval
    ? approvals.find(a => a.id === selectedApproval.id) ?? selectedApproval
    : null;

  const stats = useMemo(() => ({
    total: approvals.length,
    pendingInternal: approvals.filter(a => a.status === "pending_internal").length,
    pendingClient: approvals.filter(a => a.status === "pending_client").length,
    approved: approvals.filter(a => a.status === "approved").length,
  }), [approvals]);

  const handleAddInternalComment = async (text: string) => {
    if (!liveSelected) return;
    await addInternalComment(liveSelected.id, {
      userId: "current_user",
      userName: "You",
      userInitials: "YO",
      userColor: "var(--accent)",
      text,
      isInternal: true,
      createdAt: new Date().toISOString(),
    });
  };

  const handleAddClientComment = async (text: string) => {
    if (!liveSelected) return;
    await addClientComment(liveSelected.id, {
      userId: "current_user",
      userName: "You",
      userInitials: "YO",
      userColor: "var(--accent)",
      text,
      isInternal: false,
      createdAt: new Date().toISOString(),
    });
  };

  const handleStatusUpdate = async (status: ApprovalWorkflowStatus) => {
    if (!liveSelected) return;
    await updateApprovalStatus(liveSelected.id, status);
  };

  const selectedContentItem = liveSelected ? contentItems.find(ci => ci.id === liveSelected.contentItemId) : null;
  const selectedClient = liveSelected ? clients.find(c => c.id === liveSelected.clientId) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--accent-dim)" }}>
              <FileCheck size={18} style={{ color: "var(--accent)" }} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {t("approvals.title")}
            </h1>
          </div>
          <p className="text-sm mt-1 ms-0" style={{ color: "var(--text-muted)" }}>
            Review and manage content approval workflows
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total",            value: stats.total,           color: "var(--text-secondary)", bg: "var(--surface-2)",          icon: LayoutGrid },
          { label: "Pending Internal", value: stats.pendingInternal, color: "#4f8ef7",               bg: "rgba(79,142,247,0.10)",     icon: Users },
          { label: "Pending Client",   value: stats.pendingClient,   color: "#fbbf24",               bg: "rgba(251,191,36,0.10)",     icon: Clock },
          { label: "Approved",         value: stats.approved,        color: "#34d399",               bg: "rgba(52,211,153,0.10)",     icon: CheckCircle2 },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <motion.div
            key={label}
            whileHover={{ scale: 1.02 }}
            className="rounded-2xl p-4 flex flex-col gap-2"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon size={13} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs + Sort */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex gap-1 flex-wrap p-1 rounded-xl flex-1" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          {TABS.map(({ key, label, icon: Icon, color }) => {
            const count = key === "all" ? approvals.length : approvals.filter(a => a.status === key).length;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: isActive ? "var(--surface-1)" : "transparent",
                  color: isActive ? color : "var(--text-muted)",
                  boxShadow: isActive ? "var(--shadow-sm)" : "none",
                }}
              >
                <Icon size={12} style={{ color: isActive ? color : "var(--text-muted)" }} />
                {label}
                {count > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{
                      background: isActive ? color + "22" : "var(--surface-3)",
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

        {/* Sort dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setSortOpen(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          >
            <SortAsc size={13} />
            {sortMode === "newest" ? "Newest first" : "Recently updated"}
            <ChevronDown size={12} style={{ transform: sortOpen ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }} />
          </button>
          <AnimatePresence>
            {sortOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                className="absolute right-0 mt-1 rounded-xl overflow-hidden z-20"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)", minWidth: 160 }}
              >
                {(["newest", "updated"] as SortMode[]).map(s => (
                  <button
                    key={s}
                    onClick={() => { setSortMode(s); setSortOpen(false); }}
                    className="w-full text-left px-4 py-2.5 text-xs transition-colors"
                    style={{
                      color: sortMode === s ? "var(--accent)" : "var(--text-secondary)",
                      background: sortMode === s ? "var(--accent-dim)" : "transparent",
                    }}
                    onMouseEnter={e => { if (sortMode !== s) e.currentTarget.style.background = "var(--surface-3)"; }}
                    onMouseLeave={e => { if (sortMode !== s) e.currentTarget.style.background = ""; }}
                  >
                    {s === "newest" ? "Newest first" : "Recently updated"}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3" style={{ color: "var(--text-muted)" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          >
            <RotateCcw size={20} />
          </motion.div>
          <span className="text-sm">{t("common.loading")}</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title={t("approvals.noApprovals")}
          description={t("approvals.noApprovalsDesc")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((approval, i) => {
              const contentItem = contentItems.find(ci => ci.id === approval.contentItemId);
              return (
                <motion.div
                  key={approval.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ApprovalCard
                    approval={approval}
                    contentItem={contentItem}
                    clients={clients}
                    onClick={() => setSelectedApproval(approval)}
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {liveSelected && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedApproval(null)}
          >
            <motion.div
              className="glass-modal flex flex-col"
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 16 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              style={{ width: "min(92vw, 700px)", maxHeight: "min(90vh, 860px)" }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex-1 min-w-0 me-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-base font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {selectedContentItem?.title ?? "—"}
                    </h2>
                    {liveSelected.status && (
                      <Badge
                        label={STATUS_CONFIG[liveSelected.status].label}
                        color={STATUS_CONFIG[liveSelected.status].color}
                      />
                    )}
                  </div>
                  {selectedClient && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: selectedClient.color }}>
                        {selectedClient.initials}
                      </div>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{selectedClient.name}</span>
                      {selectedClient.company && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {selectedClient.company}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status Actions */}
              <div className="px-6 py-4 flex-shrink-0 flex flex-wrap gap-2" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <span className="text-xs font-medium self-center me-1" style={{ color: "var(--text-muted)" }}>Update status:</span>
                <button
                  onClick={() => handleStatusUpdate("approved")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: liveSelected.status === "approved" ? "rgba(52,211,153,0.18)" : "var(--surface-1)",
                    color: "#34d399",
                    border: `1px solid ${liveSelected.status === "approved" ? "#34d39944" : "var(--border)"}`,
                  }}
                >
                  <CheckCircle2 size={12} /> Approve
                </button>
                <button
                  onClick={() => handleStatusUpdate("revision_requested")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: liveSelected.status === "revision_requested" ? "rgba(167,139,250,0.18)" : "var(--surface-1)",
                    color: "#a78bfa",
                    border: `1px solid ${liveSelected.status === "revision_requested" ? "#a78bfa44" : "var(--border)"}`,
                  }}
                >
                  <RotateCcw size={12} /> Request Revision
                </button>
                <button
                  onClick={() => handleStatusUpdate("rejected")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: liveSelected.status === "rejected" ? "rgba(248,113,113,0.18)" : "var(--surface-1)",
                    color: "#f87171",
                    border: `1px solid ${liveSelected.status === "rejected" ? "#f8717144" : "var(--border)"}`,
                  }}
                >
                  <XCircle size={12} /> Reject
                </button>
                <button
                  onClick={() => handleStatusUpdate("pending_client")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: liveSelected.status === "pending_client" ? "rgba(251,191,36,0.18)" : "var(--surface-1)",
                    color: "#fbbf24",
                    border: `1px solid ${liveSelected.status === "pending_client" ? "#fbbf2444" : "var(--border)"}`,
                  }}
                >
                  <Clock size={12} /> Send to Client
                </button>
              </div>

              {/* Comment Threads */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Internal Comments */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(79,142,247,0.12)" }}>
                      <Users size={13} style={{ color: "#4f8ef7" }} />
                    </div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {t("approvals.internalComments")}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(79,142,247,0.12)", color: "#4f8ef7" }}>
                      {liveSelected.internalComments?.length ?? 0}
                    </span>
                  </div>
                  <ApprovalCommentThread
                    comments={liveSelected.internalComments ?? []}
                    onAdd={handleAddInternalComment}
                    currentUserName="You"
                    currentUserInitials="YO"
                    currentUserColor="var(--accent)"
                    title={t("approvals.internalComments")}
                  />
                </div>

                {/* Client Comments */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(251,191,36,0.12)" }}>
                      <MessageSquare size={13} style={{ color: "#fbbf24" }} />
                    </div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {t("approvals.clientComments")}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
                      {liveSelected.clientComments?.length ?? 0}
                    </span>
                  </div>
                  <ApprovalCommentThread
                    comments={liveSelected.clientComments ?? []}
                    onAdd={handleAddClientComment}
                    currentUserName="You"
                    currentUserInitials="YO"
                    currentUserColor="var(--accent)"
                    title={t("approvals.clientComments")}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 flex-shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  <AlertTriangle size={11} />
                  Internal comments are not visible to clients
                </div>
                <button
                  onClick={() => setSelectedApproval(null)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{ background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  <X size={12} /> Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
