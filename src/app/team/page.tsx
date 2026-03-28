"use client";
import { useState } from "react";
import { UserCircle, Plus, Search, Mail, Star, Send, Clock, CheckCircle, XCircle } from "lucide-react";
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
  Admin: "blue",
  Designer: "purple",
  Developer: "green",
  Manager: "yellow",
  Analyst: "gray",
};

const statusColors = { active: "#34d399", away: "#fbbf24", offline: "#55556a" };

const inviteStatusIcon = {
  pending: <Clock size={11} />,
  accepted: <CheckCircle size={11} />,
  expired: <XCircle size={11} />,
  cancelled: <XCircle size={11} />,
};

const inviteStatusColor: Record<InvitationStatus, string> = {
  pending: "#fbbf24",
  accepted: "#34d399",
  expired: "#8888a0",
  cancelled: "#f87171",
};

export default function TeamPage() {
  const { members, addMember } = useTeam();
  const { invitations, sendInvitation, cancelInvitation } = useInvitations();
  const { pushNotification } = useNotifications();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", role: "", email: "" });
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [tab, setTab] = useState<"members" | "invitations">("members");

  const filtered = members.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

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
        "Invitation Sent",
        `Invited ${inviteForm.email} as ${inviteForm.role}`,
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
        subtitle={`${members.length} ${t("team.membersCount")}`}
        icon={UserCircle}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" icon={Send} onClick={() => setInviteModalOpen(true)}>
              {t("team.inviteMember")}
            </Button>
            <Button icon={Plus} onClick={() => setModalOpen(true)}>{t("team.addMember")}</Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {(["members", "invitations"] as const).map((t_) => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === t_ ? "var(--accent)" : "transparent",
              color: tab === t_ ? "#fff" : "var(--text-secondary)",
            }}
          >
            {t_ === "members" ? t("team.title") : t("team.invitations")}
            {t_ === "invitations" && invitations.filter((i) => i.status === "pending").length > 0 && (
              <span
                className="ms-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}
              >
                {invitations.filter((i) => i.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <>
          <div className="mb-5">
            <Input placeholder={t("team.searchPlaceholder")} value={search} onChange={setSearch} icon={Search} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={UserCircle}
              title={t("team.noMembersTitle")}
              description={t("team.noMembersDesc")}
              action={<Button icon={Plus} onClick={() => setModalOpen(true)}>{t("team.addMember")}</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((member) => (
                <Card key={member.id} padding="md">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                        style={{ background: member.color }}
                      >
                        {member.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{member.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[member.status] }} />
                          <span className="text-[11px] capitalize" style={{ color: "var(--text-muted)" }}>
                            {t(`status.${member.status}`) || member.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge label={member.role} color={roleColors[member.role] || "gray"} />
                  </div>

                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-2">
                      <Mail size={12} style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{member.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star size={12} style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{member.projects} {t("team.activeProjects")}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" fullWidth>{t("common.profile")}</Button>
                    <Button variant="ghost" size="sm" icon={Mail}>{t("common.message")}</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "invitations" && (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <EmptyState
              icon={Send}
              title={t("team.noInvitesTitle")}
              description={t("team.noInvitesDesc")}
              action={
                <Button icon={Send} onClick={() => setInviteModalOpen(true)}>
                  {t("team.inviteMember")}
                </Button>
              }
            />
          ) : (
            invitations.map((inv) => (
              <Card key={inv.id} padding="md">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${inviteStatusColor[inv.status]}20` }}
                    >
                      <span style={{ color: inviteStatusColor[inv.status] }}>
                        {inviteStatusIcon[inv.status]}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {inv.name || inv.email}
                      </p>
                      <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{inv.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-end">
                      <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{inv.role}</p>
                      <div
                        className="flex items-center gap-1 text-[11px] mt-0.5"
                        style={{ color: inviteStatusColor[inv.status] }}
                      >
                        {inviteStatusIcon[inv.status]}
                        <span className="capitalize">{inv.status}</span>
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
              </Card>
            ))
          )}
        </div>
      )}

      {/* Add Member Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t("team.modalTitle")}>
        <div className="space-y-4">
          <Input
            label={t("team.nameLabel")}
            placeholder={t("team.namePlaceholder")}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
            required
          />
          <Input
            label={t("team.roleLabel")}
            placeholder={t("team.rolePlaceholder")}
            value={form.role}
            onChange={(v) => setForm((p) => ({ ...p, role: v }))}
            required
          />
          <Input
            label={t("team.emailLabel")}
            placeholder={t("team.emailPlaceholder")}
            value={form.email}
            onChange={(v) => setForm((p) => ({ ...p, email: v }))}
            type="email"
            required
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" fullWidth onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
            <Button fullWidth onClick={handleAdd} disabled={!form.name || !form.role || !form.email}>{t("team.addMember")}</Button>
          </div>
        </div>
      </Modal>

      {/* Invite Member Modal */}
      <Modal open={inviteModalOpen} onClose={() => { setInviteModalOpen(false); setInviteSuccess(false); }} title={t("team.inviteModalTitle")}>
        {inviteSuccess ? (
          <div className="flex flex-col items-center py-6 gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(52,211,153,0.15)" }}
            >
              <CheckCircle size={28} style={{ color: "#34d399" }} />
            </div>
            <p className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
              {t("team.inviteSentTitle")}
            </p>
            <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
              {t("team.inviteSentDesc")} <strong style={{ color: "var(--text-secondary)" }}>{inviteForm.email}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label={t("team.inviteEmailLabel")}
              placeholder={t("team.inviteEmailPlaceholder")}
              value={inviteForm.email}
              onChange={(v) => setInviteForm((p) => ({ ...p, email: v }))}
              type="email"
              required
            />
            <Input
              label={t("team.inviteNameLabel")}
              placeholder={t("team.inviteNamePlaceholder")}
              value={inviteForm.name}
              onChange={(v) => setInviteForm((p) => ({ ...p, name: v }))}
            />
            <Input
              label={t("team.inviteRoleLabel")}
              placeholder={t("team.inviteRolePlaceholder")}
              value={inviteForm.role}
              onChange={(v) => setInviteForm((p) => ({ ...p, role: v }))}
              required
            />
            <div
              className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.2)" }}
            >
              <Mail size={14} style={{ color: "#4f8ef7", flexShrink: 0, marginTop: 1 }} />
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
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
        )}
      </Modal>
    </div>
  );
}

