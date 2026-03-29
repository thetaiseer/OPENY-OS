"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Mail, Send, Clock, CheckCircle, XCircle,
  Trash2, MessageSquare, UserPlus, Shield, BarChart3,
} from "lucide-react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTeam } from "@/lib/AppContext";
import { useInvitations } from "@/lib/InvitationContext";
import { useNotifications } from "@/lib/NotificationContext";
import { useLanguage } from "@/lib/LanguageContext";
import type { InvitationStatus } from "@/lib/types";

const roleColors: Record<string, "blue" | "green" | "yellow" | "purple" | "gray"> = {
  Admin: "blue", Designer: "purple", Developer: "green", Manager: "yellow", Analyst: "gray",
};

const statusColors = { active: "#34d399", away: "#fbbf24", offline: "#55556a" };

const inviteStatusIcon: Record<InvitationStatus, React.ReactNode> = {
  pending: <Clock size={12} />,
  accepted: <CheckCircle size={12} />,
  expired: <XCircle size={12} />,
  cancelled: <XCircle size={12} />,
};

const inviteStatusColor: Record<InvitationStatus, string> = {
  pending: "#fbbf24", accepted: "#34d399", expired: "#8888a0", cancelled: "#f87171",
};

export default function TeamPage() {
  const { members, addMember, deleteMember } = useTeam();
  const { invitations, sendInvitation, cancelInvitation } = useInvitations();
  const { pushNotification } = useNotifications();
  const { t } = useLanguage();

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"members" | "invitations">("members");
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter((m) => m.status === "active").length;
  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const uniqueRoles = new Set(members.map((m) => m.role)).size;

  const handleAdd = () => {
    if (!form.name || !form.role || !form.email) return;
    addMember({ name: form.name, role: form.role, email: form.email });
    setForm({ name: "", role: "", email: "" });
    setModalOpen(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.email || !inviteForm.role) return;
    setInviteLoading(true);
    try {
      await sendInvitation({
        email: inviteForm.email,
        name: inviteForm.name || undefined,
        role: inviteForm.role,
        invitedBy: "Alex Chen",
      });
      await pushNotification(
        "member_invited",
        t("team.inviteSentTitle"),
        `${inviteForm.email} — ${inviteForm.role}`,
        ""
      );
      setInviteSuccess(true);
      setTimeout(() => {
        setInviteSuccess(false);
        setInviteModalOpen(false);
        setInviteForm({ email: "", name: "", role: "" });
        setTab("invitations");
      }, 1800);
    } catch (err) {
      console.error("Failed to send invite:", err);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader
        title={t("team.title")}
        subtitle={t("team.subtitle")}
        icon={Users}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Send} onClick={() => setInviteModalOpen(true)}>
              {t("team.inviteMember")}
            </Button>
            <Button icon={Plus} onClick={() => setModalOpen(true)}>
              {t("team.addMember")}
            </Button>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: t("team.totalMembers"), value: members.length, icon: Users, color: "#4f8ef7" },
          { label: t("team.activeNow"), value: activeCount, icon: CheckCircle, color: "#34d399" },
          { label: t("team.roles"), value: uniqueRoles, icon: BarChart3, color: "#a78bfa" },
          { label: t("team.pendingInvites"), value: pendingCount, icon: Clock, color: "#fbbf24" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="premium-card stat-card flex items-center gap-3 px-4 py-3"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}
            >
              <Icon size={17} style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold leading-none mb-0.5" style={{ color: "var(--text-primary)" }}>
                {value}
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 mb-5 p-1 rounded-xl w-fit"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {(["members", "invitations"] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className="relative px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            style={{
              background: tab === tabKey ? "var(--accent)" : "transparent",
              color: tab === tabKey ? "#fff" : "var(--text-secondary)",
            }}
          >
            {tabKey === "members" ? (
              <><Users size={13} />{t("team.membersTab")}</>
            ) : (
              <><Send size={13} />{t("team.invitationsTab")}</>
            )}
            {tabKey === "invitations" && pendingCount > 0 && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold leading-none"
                style={{
                  background: tab === "invitations" ? "rgba(255,255,255,0.25)" : "rgba(251,191,36,0.2)",
                  color: tab === "invitations" ? "#fff" : "#fbbf24",
                }}
              >
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "members" && (
          <motion.div
            key="members"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-5">
              <Input
                placeholder={t("team.searchPlaceholder")}
                value={search}
                onChange={setSearch}
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t("team.noMembersTitle")}
                description={t("team.noMembersDesc")}
                action={
                  <Button icon={Plus} onClick={() => setModalOpen(true)}>
                    {t("team.addMember")}
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((member, i) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div
                      className="premium-card p-5 flex flex-col gap-4 h-full"
                      style={{ borderRadius: "1rem" }}
                    >
                      {/* Avatar + status + role */}
                      <div className="flex items-start justify-between">
                        <div className="relative">
                          <div
                            className="w-[60px] h-[60px] rounded-2xl flex items-center justify-center text-xl font-bold text-white select-none"
                            style={{ background: member.color }}
                          >
                            {member.initials}
                          </div>
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2"
                            style={{
                              background: statusColors[member.status],
                              borderColor: "var(--surface-0)",
                            }}
                          />
                        </div>
                        <Badge label={member.role} color={roleColors[member.role] ?? "gray"} />
                      </div>

                      {/* Info */}
                      <div>
                        <p className="text-base font-bold leading-tight mb-1" style={{ color: "var(--text-primary)" }}>
                          {member.name}
                        </p>
                        <div
                          className="flex items-center gap-1.5 text-[11px] mb-2"
                          style={{ color: statusColors[member.status] }}
                        >
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: statusColors[member.status] }}
                          />
                          <span className="capitalize font-medium">{member.status}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span
                            className="text-[11px] truncate"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {member.email}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div
                        className="flex gap-2 pt-3"
                        style={{ borderTop: "1px solid var(--border)", marginTop: "auto" }}
                      >
                        <button
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                          style={{
                            background: "var(--surface-3)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <MessageSquare size={12} />
                          {t("common.message")}
                        </button>
                        <button
                          onClick={() => deleteMember(member.id)}
                          className="flex items-center justify-center w-9 h-9 rounded-xl transition-all"
                          style={{
                            background: "rgba(248,113,113,0.08)",
                            color: "#f87171",
                            border: "1px solid rgba(248,113,113,0.15)",
                          }}
                          title={t("common.delete")}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {tab === "invitations" && (
          <motion.div
            key="invitations"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            {invitations.length === 0 ? (
              <EmptyState
                icon={Send}
                title={t("team.noInvitesTitle")}
                description={t("team.noInvitesDesc")}
                action={
                  <Button icon={UserPlus} onClick={() => setInviteModalOpen(true)}>
                    {t("team.inviteMember")}
                  </Button>
                }
              />
            ) : (
              invitations.map((inv, i) => (
                <motion.div
                  key={inv.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="premium-card px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${inviteStatusColor[inv.status]}18` }}
                        >
                          <span style={{ color: inviteStatusColor[inv.status] }}>
                            {inviteStatusIcon[inv.status]}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                            {inv.name || inv.email}
                          </p>
                          {inv.name && (
                            <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                              {inv.email}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-end">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {inv.role}
                          </p>
                          <div
                            className="flex items-center gap-1 text-[11px] mt-0.5 justify-end"
                            style={{ color: inviteStatusColor[inv.status] }}
                          >
                            {inviteStatusIcon[inv.status]}
                            <span className="capitalize font-medium">{inv.status}</span>
                          </div>
                        </div>
                        {inv.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInvitation(inv.id)}
                          >
                            {t("common.cancel")}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add Member Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("team.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("team.nameLabel")}
            placeholder={t("team.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
          />
          <Input
            label={t("team.roleLabel")}
            placeholder={t("team.rolePlaceholder")}
            value={form.role}
            onChange={(v) => setForm((p) => ({ ...p, role: v }))}
          />
          <Input
            label={t("team.emailLabel")}
            placeholder={t("team.emailPlaceholder")}
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            type="email"
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              fullWidth
              icon={Plus}
              onClick={handleAdd}
              disabled={!form.name || !form.role || !form.email}
            >
              {t("team.addMember")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Invite Member Modal ── */}
      <Modal
        open={inviteModalOpen}
        onClose={() => { setInviteModalOpen(false); setInviteSuccess(false); }}
        title={t("team.inviteModalTitle")}
      >
        <AnimatePresence mode="wait">
          {inviteSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 gap-4"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.12)" }}
              >
                <CheckCircle size={32} style={{ color: "#34d399" }} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {t("team.inviteSentTitle")}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {t("team.inviteSentDesc")}{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>{inviteForm.email}</strong>
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="space-y-4">
                <Input
                  label={t("team.inviteEmailLabel")}
                  placeholder={t("team.inviteEmailPlaceholder")}
                  value={inviteForm.email}
                  onChange={(v) => setInviteForm((p) => ({ ...p, email: v }))}
                  type="email"
                />
                <Input
                  label={`${t("team.inviteNameLabel")} (${t("common.optional")})`}
                  placeholder={t("team.inviteNamePlaceholder")}
                  value={inviteForm.name}
                  onChange={(v) => setInviteForm((p) => ({ ...p, name: v }))}
                />
                <Input
                  label={t("team.inviteRoleLabel")}
                  placeholder={t("team.inviteRolePlaceholder")}
                  value={inviteForm.role}
                  onChange={(v) => setInviteForm((p) => ({ ...p, role: v }))}
                />
                <div
                  className="flex items-start gap-2.5 p-3 rounded-xl"
                  style={{
                    background: "rgba(79,142,247,0.07)",
                    border: "1px solid rgba(79,142,247,0.18)",
                  }}
                >
                  <Mail size={13} style={{ color: "#4f8ef7", flexShrink: 0, marginTop: 1 }} />
                  <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {t("team.inviteEmailNote")}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" fullWidth onClick={() => setInviteModalOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    fullWidth
                    icon={Send}
                    onClick={handleInvite}
                    disabled={!inviteForm.email || !inviteForm.role || inviteLoading}
                  >
                    {inviteLoading ? t("team.inviteSending") : t("team.sendInvite")}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </div>
  );
}
